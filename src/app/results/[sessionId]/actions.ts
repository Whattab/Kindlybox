"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/utils/supabase/admin";
import { looksLikeEmail, suggestEmailFix } from "@/lib/email-typo";
import { loadSessionPicks, normalizeSuggestion, sendResultsEmail, SUGGESTION_SELECT } from "@/lib/quiz-email";
import { answersFromSession, runRecommendation, swapOnePick } from "@/lib/quiz-run";
import { cheaperBudget, variantKey, type RecommendOptions, type Refinement } from "@/lib/recommend";

export async function saveGiftToProfile(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const gift_name = formData.get("gift_name") as string;
  const gift_description = formData.get("gift_description") as string;
  const image_url = formData.get("image_url") as string;
  const gift_id = formData.get("gift_id") as string | null;
  const price_paid = formData.get("price_paid") ? Number(formData.get("price_paid")) : null;
  const session_id = formData.get("session_id") as string;

  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    gift_name,
    gift_id: gift_id || null,
    notes: gift_description || null,
    price_paid,
    status: "saved",
    purchased_at: new Date().toISOString().split("T")[0],
    recipient_name: "Saved from quiz",
  };

  if (image_url) {
    insertPayload.gift_image_url = image_url;
  }

  let { error } = await supabase.from("purchases").insert(insertPayload);

  if (error && (error.message.includes("gift_image_url") || error.code === "42703")) {
    const fallbackPayload = { ...insertPayload };
    delete fallbackPayload.gift_image_url;
    ({ error } = await supabase.from("purchases").insert(fallbackPayload));
  }

  if (error) {
    console.error("Save gift error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/gifts");
  revalidatePath(`/results/${session_id}`);
  redirect(`/dashboard/gifts`);
}

// ── "Email me these picks" (Step 6c) ─────────────────────────────────────
// The v2 quiz no longer asks for an email up front; the shopper opts in here.
// Results links are shareable, so to stop a link being used to fire emails at
// arbitrary addresses, a session can be emailed ONCE: the address is claimed
// with a conditional update (only while email_captured is still empty).

export type EmailPicksResult = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function emailMyPicks(
  sessionId: string, firstName: string, email: string, typoConfirmed = false,
): Promise<EmailPicksResult> {
  const to = (email || "").trim();
  const name = (firstName || "").trim().slice(0, 80);
  if (!UUID.test(sessionId || "")) return { ok: false, error: "We couldn't find these results." };
  if (!looksLikeEmail(to) || to.length > 254) return { ok: false, error: "Please enter a valid email address." };
  // A known domain typo (gmail.col) bounces — never send it unless the
  // shopper explicitly said "keep it" (the form asks first).
  const fix = suggestEmailFix(to);
  if (fix && !typoConfirmed) return { ok: false, error: `Did you mean ${fix}?` };

  const db = createServiceClient();
  const { data: claimed, error } = await db
    .from("quiz_sessions")
    .update({ email_captured: to, first_name_captured: name || null })
    .eq("id", sessionId)
    .is("email_captured", null)
    .select("id, answers");
  if (error) {
    console.error("[email-picks] claim failed:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (!claimed || claimed.length === 0) return { ok: false, error: "These picks have already been emailed." };

  const picks = await loadSessionPicks(db, sessionId);
  // Greeting (owner rule): the shopper's name if typed, else the gift recipient's.
  const recipientName = String(claimed[0]?.answers?.recipientName || "").trim();
  const greetName = name || recipientName || undefined;
  const sent = picks.length > 0 && (await sendResultsEmail({ to, firstName: greetName, recommendations: picks, sessionId }));
  if (!sent) {
    // Release the claim so the shopper can retry.
    await db.from("quiz_sessions").update({ email_captured: null, first_name_captured: null }).eq("id", sessionId).eq("email_captured", to);
    return { ok: false, error: "We couldn't send the email. Please try again." };
  }
  return { ok: true };
}

// ── Refinement buttons (Step 7) ──────────────────────────────────────────
// "Cheaper / More unique / An experience instead / Last-minute ideas" re-run
// the recommender with the original answers plus the refinement, and open the
// result as a NEW session (its own link; Back returns to the original). Every
// gift already shown in the chain is excluded, so a refinement never repeats.

const REFINEMENTS: Refinement[] = ["cheaper", "unique", "experience", "last-minute"];
const MAX_REFINE_DEPTH = 10;

export async function refineResults(formData: FormData) {
  const sessionId = String(formData.get("session_id") || "");
  const kind = String(formData.get("kind") || "") as Refinement;
  if (!UUID.test(sessionId) || !REFINEMENTS.includes(kind)) redirect("/quiz");

  const db = createServiceClient();
  const { data: parent } = await db.from("quiz_sessions").select("id, answers, user_id").eq("id", sessionId).maybeSingle();
  if (!parent) redirect("/quiz");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stored answers are free-form JSON
  const stored: Record<string, any> = parent.answers || {};
  const depth = Number(stored.refinementDepth || 0);
  if (depth >= MAX_REFINE_DEPTH) redirect(`/results/${sessionId}?refine=limit`);

  // Everything shown so far in this chain = earlier refinements + these picks.
  const { data: sug } = await db.from("gift_suggestions").select(SUGGESTION_SELECT).eq("session_id", sessionId);
  const current = (sug || []).map(normalizeSuggestion).filter((n): n is NonNullable<typeof n> => !!n);
  const shownIds: string[] = Array.from(new Set([...(stored.shown?.ids || []), ...current.map((c) => c.gift.id)]));
  const shownNames: string[] = Array.from(new Set([...(stored.shown?.names || []), ...current.map((c) => variantKey(c.gift.name || ""))]));

  const answers = answersFromSession(stored);
  const options: RecommendOptions = { excludeIds: shownIds, excludeNames: shownNames };
  let budget = answers.budget;
  if (kind === "cheaper") {
    // Cheaper than the priciest current pick (the cheapest was often ~$8,
    // which left only unrelated filler) and one budget band down.
    budget = cheaperBudget(budget);
    const prices = current.map((c) => Number(c.gift.price_min)).filter((p) => p > 0);
    if (prices.length) options.priceCeiling = Math.max(...prices);
    options.strict = true;
  } else {
    options.refinement = kind;
    // "More unique" must stay on-topic; gift cards / experiences are generic
    // by nature, so those two may fall back to the best non-matching ones.
    if (kind === "unique") options.strict = true;
  }
  const refinedAnswers = { ...answers, budget, giftFeel: kind === "experience" ? "experience" : answers.giftFeel };

  const run = await runRecommendation({
    db,
    answers: refinedAnswers,
    storedAnswers: {
      ...stored, budget,
      refinedFrom: sessionId, refinement: kind, refinementDepth: depth + 1,
      shown: { ids: shownIds, names: shownNames },
    },
    userId: parent.user_id ?? null,
    emailCaptured: null,     // the new page offers "Email me these picks" again
    firstNameCaptured: null,
    personalize: { answers: { ...refinedAnswers, recipientName: stored.recipientName }, recipientName: stored.recipientName },
    options,
  });

  if (!run.ok) redirect(`/results/${sessionId}?refine=none&kind=${kind}`);
  redirect(`/results/${run.sessionId}`);
}

// ── "Not quite" swap on one gift (Step 7b) ────────────────────────────────
export async function swapPick(formData: FormData) {
  const sessionId = String(formData.get("session_id") || "");
  const suggestionId = String(formData.get("suggestion_id") || "");
  if (!UUID.test(sessionId) || !UUID.test(suggestionId)) redirect("/quiz");

  const db = createServiceClient();
  const { data: parent } = await db.from("quiz_sessions").select("id, answers, user_id").eq("id", sessionId).maybeSingle();
  if (!parent) redirect("/quiz");
  if (Number(parent.answers?.refinementDepth || 0) >= MAX_REFINE_DEPTH) redirect(`/results/${sessionId}?refine=limit`);

  const res = await swapOnePick({ db, parent, suggestionId });
  if (!res.ok) redirect(`/results/${sessionId}?refine=none&kind=swap`);
  redirect(`/results/${res.sessionId}`);
}
