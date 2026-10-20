// One quiz → three gifts → saved session. Shared by the quiz submit route and
// the results-page refinements (Step 7), so there's a single pipeline:
// load catalogue → recommend → save session → "why" notes → save picks.
// Free-text interpretation and emailing stay with the callers.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getRecommendations, variantKey, type GiftScore, type QuizAnswers, type RecommendOptions } from "./recommend";
import { normalizeSuggestion, SUGGESTION_SELECT } from "./quiz-email";
import { loadProductCandidates } from "./affiliate/candidates";
import { generatePersonalizedReasons } from "./personalize";
import { parseV2State, toQuizAnswers } from "./quiz-v2/map";

export type SavedPick = GiftScore & { personalizedReason: string | null; suggestionId?: string };

export type RunResult =
  | { ok: true; sessionId: string; recommendations: SavedPick[] }
  | { ok: false; reason: "catalog" | "no-matches" | "session" };

export async function runRecommendation(input: {
  db: SupabaseClient;
  /** What the recommender scores with (interpreted interests/avoids blended in). */
  answers: QuizAnswers;
  /** What's stored on quiz_sessions.answers (the results page reads it). */
  storedAnswers: Record<string, unknown>;
  userId: string | null;
  emailCaptured: string | null;
  firstNameCaptured: string | null;
  /** Answers + name the "why we picked this" notes are written for. */
  personalize: { answers: QuizAnswers; recipientName?: string };
  options?: RecommendOptions;
}): Promise<RunResult> {
  const { db, answers } = input;

  const { data: gifts, error: giftsError } = await db.from("gifts").select("*").eq("active", true);
  if (giftsError) {
    console.error("Gifts fetch error:", giftsError);
    return { ok: false, reason: "catalog" };
  }

  // A FREE BLEND of the curated catalogue and the affiliate products (pre-
  // filtered to fit the answers). The scorer treats both identically.
  const productCandidates = await loadProductCandidates(answers, {
    noShip: input.options?.refinement === "last-minute" || input.options?.refinement === "experience",
  });
  const catalogue = [...(gifts || []), ...productCandidates];

  // The seed rotates which of several equally-good gifts get shown, so two
  // people giving identical answers don't always see the exact same three.
  const recommendations = getRecommendations(answers, catalogue, { seed: Date.now(), ...input.options });
  if (recommendations.length === 0) return { ok: false, reason: "no-matches" };

  const { data: sessionData, error: sessionError } = await db
    .from("quiz_sessions")
    .insert([{
      user_id: input.userId,
      answers: input.storedAnswers,
      email_captured: input.emailCaptured,
      first_name_captured: input.firstNameCaptured,
    }])
    .select("id")
    .single();
  if (sessionError || !sessionData) {
    console.error("Session creation error:", sessionError);
    return { ok: false, reason: "session" };
  }
  const sessionId: string = sessionData.id;

  // "Why we picked this" notes. Fail-soft: null on errors.
  const reasons = await generatePersonalizedReasons(
    input.personalize.answers,
    recommendations.map((r) => r.gift),
    input.personalize.recipientName,
  );
  const picks: SavedPick[] = recommendations.map((rec, i) => ({ ...rec, personalizedReason: reasons[i] ?? null }));

  // A pick is either a curated gift (gift_id) or an affiliate product
  // (product_id), flagged by `source` so the results page reads the right table.
  const rows = picks.map((rec, index) => {
    const isProduct = (rec.gift as { __source?: string }).__source === "product";
    return {
      session_id: sessionId,
      gift_id: isProduct ? null : rec.gift.id,
      product_id: isProduct ? (rec.gift as { __productId?: string }).__productId : null,
      source: isProduct ? "product" : "gift",
      match_score: rec.matchScorePercent,
      rank: index + 1,
      personalized_reason: rec.personalizedReason,
    };
  });
  const { data: saved, error: suggestionsError } = await db.from("gift_suggestions").insert(rows).select("id, rank");
  if (suggestionsError) console.error("Suggestions save error:", suggestionsError);

  // The email's buy buttons use the tracked redirect (/go/s/<id>).
  picks.forEach((p, i) => { p.suggestionId = saved?.find((s) => s.rank === i + 1)?.id; });

  return { ok: true, sessionId, recommendations: picks };
}

/**
 * Rebuild the recommender's answers from a stored session (for refinements).
 * v2 sessions re-map their raw state (so relationship rules, feel and level
 * come back); both versions re-blend the interpreted free-text tags.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- stored answers are free-form JSON
export function answersFromSession(stored: Record<string, any>): QuizAnswers {
  const base: QuizAnswers = stored?.v2
    ? toQuizAnswers(parseV2State(stored.v2))
    : {
        recipient: stored?.recipient || "", occasion: stored?.occasion || "", interests: stored?.interests || [],
        budget: stored?.budget || "no-limit", ageGroup: stored?.ageGroup || "", gender: stored?.gender || "unknown",
        freeText: stored?.freeText, recipientName: stored?.recipientName,
      };
  const interpreted = stored?.interpreted || {};
  return {
    ...base,
    budget: stored?.budget || base.budget,
    interests: Array.from(new Set([...(base.interests || []), ...(interpreted.interests || [])])),
    avoidFlags: Array.from(new Set([...(base.avoidFlags || []), ...(interpreted.avoid_flags || [])])),
  };
}

/**
 * "Not quite" (Step 7b): keep the other picks, replace ONE with the next-best
 * gift not yet shown in this chain, and save it as a new session (its own
 * link; Back returns). Only the new pick gets a fresh "why" note.
 */
export async function swapOnePick(input: {
  db: SupabaseClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stored answers are free-form JSON
  parent: { id: string; user_id: string | null; answers: Record<string, any> };
  suggestionId: string;
}): Promise<{ ok: true; sessionId: string } | { ok: false; reason: "not-found" | "no-matches" | "session" }> {
  const { db, parent, suggestionId } = input;
  const stored = parent.answers || {};

  const { data: sug } = await db.from("gift_suggestions").select(SUGGESTION_SELECT).eq("session_id", parent.id).order("rank");
  const current = (sug || []).map((s) => ({ row: s, n: normalizeSuggestion(s) })).filter((x) => !!x.n);
  const target = current.find((x) => x.row.id === suggestionId);
  if (!target) return { ok: false, reason: "not-found" };

  const shownIds = Array.from(new Set([...(stored.shown?.ids || []), ...current.map((x) => x.n!.gift.id)]));
  const shownNames = Array.from(new Set([...(stored.shown?.names || []), ...current.map((x) => variantKey(x.n!.gift.name || ""))]));

  const answers = answersFromSession(stored);
  const { data: gifts } = await db.from("gifts").select("*").eq("active", true);
  const catalogue = [...(gifts || []), ...(await loadProductCandidates(answers))];
  // One gift per shop: the replacement can't come from a shop the kept picks use.
  const keptShops = current.filter((x) => x.row.id !== suggestionId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined row shape
    .map((x) => (x.row as any).products?.merchant_name as string | undefined).filter((m): m is string => !!m);
  const pickOne = (strict: boolean) => getRecommendations(answers, catalogue, {
    seed: Date.now(), limit: 1, excludeIds: shownIds, excludeNames: shownNames, excludeMerchants: keptShops, strict,
  })[0];
  // Prefer a genuine match; only fall back to the best remaining gift if none.
  const replacement = pickOne(true) || pickOne(false);
  if (!replacement) return { ok: false, reason: "no-matches" };

  const { data: session, error } = await db.from("quiz_sessions").insert([{
    user_id: parent.user_id,
    answers: {
      ...stored, refinedFrom: parent.id, refinement: "swap",
      refinementDepth: Number(stored.refinementDepth || 0) + 1,
      shown: { ids: shownIds, names: shownNames },
    },
    email_captured: null,      // the new page offers "Email me these picks" again
    first_name_captured: null,
  }]).select("id").single();
  if (error || !session) {
    console.error("Swap session error:", error);
    return { ok: false, reason: "session" };
  }

  const [reason] = await generatePersonalizedReasons(
    { ...answers, recipientName: stored.recipientName }, [replacement.gift], stored.recipientName,
  );
  const isProduct = (replacement.gift as { __source?: string }).__source === "product";
  const rows = current.map(({ row, n }) => row.id === suggestionId
    ? {
        session_id: session.id, rank: row.rank,
        gift_id: isProduct ? null : replacement.gift.id,
        product_id: isProduct ? (replacement.gift as { __productId?: string }).__productId : null,
        source: isProduct ? "product" : "gift",
        match_score: replacement.matchScorePercent,
        personalized_reason: reason ?? null,
      }
    : {
        session_id: session.id, rank: row.rank,
        gift_id: n!.isProduct ? null : n!.gift.id,
        product_id: n!.isProduct ? row.product_id : null,
        source: n!.isProduct ? "product" : "gift",
        match_score: row.match_score,
        personalized_reason: row.personalized_reason,
      });
  const { error: sugErr } = await db.from("gift_suggestions").insert(rows);
  if (sugErr) console.error("Swap suggestions error:", sugErr);

  return { ok: true, sessionId: session.id };
}
