// KindlyBox Gift Intelligence Engine — Phase 1 pipeline.
//
// One run:
//   1. Load context: upcoming occasions, first-party quiz demand, catalog, weights
//   2. Harvest real search queries (Google Autocomplete) → store as trend evidence
//   3. Generate candidate article topics (recipients × occasions × niches)
//   4. Score each 0–100 across 7 factors (weighted) with honest provenance
//   5. Build a mandatory evidence-based "Why now?"
//   6. AI-polish titles (fail-soft) and upsert into content_opportunities
//
// Every score carries provenance (measured | ai_estimated) so the dashboard can
// always show "genuinely popular" vs "AI's best guess".

import { createServiceClient } from "@/utils/supabase/admin";
import { upcomingOccasions, type UpcomingOccasion } from "./holiday-calendar";
import { harvest } from "./google-suggest";
import { getFirstPartyDemand, type FirstPartyDemand } from "./firstparty";
import { enrichTitles } from "./enrich";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// Friendly labels for the recipient keys the quiz collects.
const RECIPIENT_LABEL: Record<string, string> = {
  her: "Her", him: "Him", mom: "Mom", dad: "Dad", parent: "Parents",
  partner: "Your Partner", friend: "Friends", sibling: "Siblings",
  "co-worker": "Coworkers", coworker: "Coworkers", child: "Kids", graduate: "Graduates",
};
const recipientLabel = (k: string) => RECIPIENT_LABEL[k] || titleCase(k);

interface Gift {
  id: string; name: string; description: string | null;
  tags: string[] | null; occasions: string[] | null; recipients: string[] | null;
  affiliate_url: string | null;
}

interface Candidate {
  topic: string;
  primary_keyword: string;
  category: string;
  recipientKey?: string;
  occasionKey?: string;
  occasion?: UpcomingOccasion;
}

// ---- scoring helpers ------------------------------------------------------

function scoreSearch(keyword: string, allSuggestions: string[]): { score: number; provenance: string } {
  const k = keyword.toLowerCase();
  const stop = new Set(["for", "best", "gifts", "gift", "the", "and", "ideas", "a"]);
  const terms = k.split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
  let matches = 0;
  for (const s of allSuggestions) {
    if (s.includes(k) || (terms.length > 0 && terms.every((t) => s.includes(t)))) matches++;
  }
  if (matches > 0) return { score: clamp(60 + matches * 6, 60, 100), provenance: "measured" };
  const partial = allSuggestions.some((s) => terms.some((t) => s.includes(t)));
  return { score: partial ? 55 : 45, provenance: "ai_estimated" };
}

// Higher competition_score = LESS competition = better opportunity (specific,
// long-tail topics are easier to rank for than broad head terms).
function scoreCompetition(topic: string): number {
  const words = topic.split(/\s+/).length;
  let s = 40 + (words - 3) * 10;
  if (/personalized|custom|unique/i.test(topic)) s += 12;
  return clamp(s, 25, 92);
}

// Generic words that would match almost any gift — excluded from catalog search
// so product matches reflect the actual recipient/occasion/interest, not "gift".
const CATALOG_STOP = new Set(["for", "best", "gift", "gifts", "ideas", "idea", "the", "and", "your", "top", "great", "good"]);

function catalogMatch(gifts: Gift[], terms: string[]) {
  const needles = [...new Set(terms.map((t) => t.toLowerCase()))].filter((t) => t.length > 2 && !CATALOG_STOP.has(t));
  if (needles.length === 0) return { score: 30, products: [] as { gift_id: string; name: string; affiliate_url: string | null }[], count: 0, withAff: 0 };
  const matched = gifts.filter((g) => {
    const hay = [g.name, g.description, (g.tags || []).join(" "), (g.occasions || []).join(" "), (g.recipients || []).join(" ")]
      .join(" ")
      .toLowerCase();
    return needles.some((n) => hay.includes(n));
  });
  const withAff = matched.filter((g) => g.affiliate_url);
  const ordered = [...withAff, ...matched.filter((g) => !g.affiliate_url)];
  const products = ordered.slice(0, 5).map((g) => ({ gift_id: g.id, name: g.name, affiliate_url: g.affiliate_url }));
  const n = withAff.length;
  const score = n >= 6 ? 90 : n >= 3 ? 75 : n >= 1 ? 58 : matched.length >= 1 ? 40 : 25;
  return { score, products, count: matched.length, withAff: withAff.length };
}

// ---- candidate generation -------------------------------------------------

function buildCandidates(demand: FirstPartyDemand, occasions: UpcomingOccasion[], suggestBySeed: Map<string, string[]>): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const push = (c: Candidate) => {
    const key = norm(c.topic);
    if (!seen.has(key)) { seen.add(key); out.push(c); }
  };

  // A. Recipients — from real first-party demand, plus a couple of evergreens.
  const recipients = new Set<string>([...Object.keys(demand.recipients), "her", "him", "mom", "dad"]);
  for (const key of recipients) {
    const label = recipientLabel(key);
    push({ topic: `Best Gifts for ${label}`, primary_keyword: `gifts for ${key}`, category: "Recipient", recipientKey: key });
    push({ topic: `Best Personalized Gifts for ${label}`, primary_keyword: `personalized gifts for ${key}`, category: "Personalized", recipientKey: key });
  }

  // B. Occasions — anything within the shopping horizon (~4 months out).
  for (const occ of occasions.filter((o) => o.daysUntil <= 120)) {
    push({ topic: `Best ${occ.label} Gifts`, primary_keyword: `${occ.label.toLowerCase()} gifts`, category: "Seasonal", occasionKey: occ.key, occasion: occ });
    if (occ.recipientHint) {
      const hint = recipientLabel(occ.recipientHint);
      push({ topic: `Best ${occ.label} Gifts for ${hint}`, primary_keyword: `${occ.label.toLowerCase()} gifts for ${occ.recipientHint}`, category: "Seasonal", occasionKey: occ.key, occasion: occ, recipientKey: occ.recipientHint });
    }
  }

  // C. Niches straight from Google's autocomplete (real emerging long-tail).
  for (const seed of ["unique gifts for", "personalized gifts for"]) {
    const sugg = suggestBySeed.get(seed) || [];
    for (const s of sugg.slice(0, 4)) {
      push({ topic: titleCase(s), primary_keyword: s, category: "Search Trend" });
    }
  }

  return out;
}

// ---- main run -------------------------------------------------------------

export interface RunSummary {
  ran_at: string;
  trends_stored: number;
  candidates: number;
  opportunities_new: number;
  opportunities_updated: number;
  top: { topic: string; overall_score: number; why_now: string }[];
}

export async function runIntelligenceEngine(): Promise<RunSummary> {
  const admin = createServiceClient();

  // 1. Context
  const [{ data: weightRows }, { data: giftRows }, demand] = await Promise.all([
    admin.from("scoring_weights").select("factor, weight"),
    admin.from("gifts").select("id, name, description, tags, occasions, recipients, affiliate_url").eq("active", true),
    getFirstPartyDemand(),
  ]);
  const weights: Record<string, number> = {};
  for (const w of weightRows || []) weights[w.factor] = Number(w.weight);
  const gifts = (giftRows || []) as Gift[];
  const occasions = upcomingOccasions();

  const { data: sources } = await admin.from("trend_sources").select("id, source_name");
  const sourceId = (name: string) => (sources || []).find((s) => s.source_name === name)?.id ?? null;

  // 2. Harvest real search queries from Google Autocomplete.
  const topRecipients = Object.keys(demand.recipients).slice(0, 6);
  const seeds = [
    "personalized gifts for", "unique gifts for", "gift ideas for", "best gifts for",
    ...topRecipients.map((r) => `gifts for ${r}`),
    ...occasions.filter((o) => o.daysUntil <= 120).map((o) => `${o.label.toLowerCase()} gifts`),
  ];
  const harvested = await harvest([...new Set(seeds)]);
  const suggestBySeed = new Map(harvested.map((h) => [h.seed, h.suggestions.map((s) => s.toLowerCase())]));
  const allSuggestions = harvested.flatMap((h) => h.suggestions.map((s) => s.toLowerCase()));

  // 2b. Store harvested clusters as trend evidence (measured).
  const gtSource = sourceId("Google Trends");
  let trendsStored = 0;
  for (const h of harvested) {
    if (h.suggestions.length === 0) continue;
    const { error } = await admin.from("gift_trends").upsert(
      {
        trend_name: h.seed,
        category: "Search",
        search_volume: h.suggestions.length,
        trend_direction: "steady",
        source_id: gtSource,
        source: "Google Autocomplete",
        source_url: "https://suggestqueries.google.com",
        provenance: "measured",
        confidence: 0.8,
        related_keywords: h.suggestions.slice(0, 10),
        evidence: { suggestions: h.suggestions },
        last_updated: new Date().toISOString(),
      },
      { onConflict: "trend_name,source_id" },
    );
    if (!error) trendsStored++;
  }

  // Mark the active sources as checked.
  const now = new Date().toISOString();
  for (const name of ["Google Trends", "Holiday & Occasion Calendar", "KindlyBox Quiz Data"]) {
    const id = sourceId(name);
    if (id) await admin.from("trend_sources").update({ last_checked: now, last_status: "ok" }).eq("id", id);
  }

  // 3. Candidates
  const candidates = buildCandidates(demand, occasions, suggestBySeed);

  // 4. Score
  const enrichment = await enrichTitles(candidates.map((c) => ({ topic: c.topic, primary_keyword: c.primary_keyword })));

  const scored = candidates.map((c) => {
    const search = scoreSearch(c.primary_keyword, allSuggestions);
    const competition = scoreCompetition(c.topic);
    const terms = [
      c.recipientKey ? recipientLabel(c.recipientKey) : "",
      c.occasion?.label || "",
      ...c.primary_keyword.split(/\s+/),
    ].filter(Boolean);
    const cat = catalogMatch(gifts, terms);

    const growth = c.occasion && c.occasion.daysUntil >= 7 && c.occasion.daysUntil <= 56 ? 72 : c.category === "Search Trend" ? 60 : 50;
    const seasonal = c.occasion ? c.occasion.seasonalScore : 45;
    const kindlybox =
      c.recipientKey && demand.recipients[c.recipientKey] != null ? demand.recipients[c.recipientKey]
      : c.occasionKey && demand.occasions[c.occasionKey] != null ? demand.occasions[c.occasionKey]
      : 20;
    const freshness = 100;

    const factors: Record<string, number> = {
      search: search.score, growth, competition, affiliate: cat.score,
      seasonal, kindlybox, freshness,
    };
    let ws = 0, tw = 0;
    for (const [f, v] of Object.entries(factors)) { const w = weights[f] ?? 1; ws += v * w; tw += w; }
    const overall = clamp(ws / (tw || 1), 0, 100);

    // Mandatory, evidence-based "Why now?" — real numbers only.
    const pieces: string[] = [];
    if (c.occasion) pieces.push(`${c.occasion.label} is ${c.occasion.daysUntil} days away`);
    if (c.recipientKey && demand.recipientPct[c.recipientKey]) pieces.push(`${demand.recipientPct[c.recipientKey]}% of recent quiz shoppers are buying for ${recipientLabel(c.recipientKey).toLowerCase()}`);
    if (c.occasionKey && demand.occasionPct[c.occasionKey]) pieces.push(`${demand.occasionPct[c.occasionKey]}% of recent quizzes are for this occasion`);
    if (search.provenance === "measured") pieces.push(`"${c.primary_keyword}" shows real Google search demand`);
    if (cat.count > 0) pieces.push(`${cat.count} matching product${cat.count > 1 ? "s" : ""} in your catalog${cat.withAff > 0 ? ` (${cat.withAff} with affiliate links)` : ""}`);
    if (pieces.length === 0) pieces.push("Evergreen gift topic with steady year-round demand");
    const why_now = pieces.join("; ").replace(/^./, (ch) => ch.toUpperCase()) + ".";

    const e = enrichment[c.topic];
    return {
      candidate: c,
      suggested_title: e?.suggested_title || c.topic,
      content_type: e?.content_type || (c.category === "Seasonal" ? "gift_guide" : "listicle"),
      secondary_keywords: e?.secondary_keywords || [],
      factors, overall, why_now,
      recommended_products: cat.products,
      score_breakdown: {
        weights,
        factors: {
          search: { score: search.score, provenance: search.provenance },
          growth: { score: growth, provenance: "ai_estimated" },
          competition: { score: competition, provenance: "heuristic" },
          affiliate: { score: cat.score, provenance: "measured", matches: cat.count, with_affiliate: cat.withAff },
          seasonal: { score: seasonal, provenance: c.occasion ? "measured" : "n/a" },
          kindlybox: { score: kindlybox, provenance: c.recipientKey || c.occasionKey ? "measured" : "ai_estimated" },
          freshness: { score: freshness, provenance: "measured" },
        },
      },
    };
  });

  scored.sort((a, b) => b.overall - a.overall);

  // 6. Upsert opportunities (never clobber human-progressed rows).
  const { data: existing } = await admin.from("content_opportunities").select("id, topic, status");
  const byTopic = new Map((existing || []).map((r) => [norm(r.topic), r]));
  // Never overwrite rows a human has acted on — including dismissed ones, so a
  // re-run can't resurrect something you archived.
  const LOCKED = new Set(["APPROVED", "WRITING", "REVIEW", "PUBLISHED", "ARCHIVED"]);

  let created = 0, updated = 0;
  for (const s of scored) {
    const row = {
      topic: s.candidate.topic,
      suggested_title: s.suggested_title,
      content_type: s.content_type,
      primary_keyword: s.candidate.primary_keyword,
      secondary_keywords: s.secondary_keywords,
      search_score: s.factors.search,
      growth_score: s.factors.growth,
      competition_score: s.factors.competition,
      affiliate_score: s.factors.affiliate,
      seasonal_score: s.factors.seasonal,
      kindlybox_score: s.factors.kindlybox,
      freshness_score: s.factors.freshness,
      overall_score: s.overall,
      score_breakdown: s.score_breakdown,
      why_now: s.why_now,
      recommended_products: s.recommended_products,
      status: "RECOMMENDED",
      updated_at: now,
    };
    const found = byTopic.get(norm(s.candidate.topic));
    if (found) {
      if (LOCKED.has(found.status)) continue;
      const { status, ...noStatus } = row; // don't reset a human's status
      await admin.from("content_opportunities").update(noStatus).eq("id", found.id);
      updated++;
    } else {
      await admin.from("content_opportunities").insert(row);
      created++;
    }
  }

  return {
    ran_at: now,
    trends_stored: trendsStored,
    candidates: candidates.length,
    opportunities_new: created,
    opportunities_updated: updated,
    top: scored.slice(0, 10).map((s) => ({ topic: s.candidate.topic, overall_score: s.overall, why_now: s.why_now })),
  };
}
