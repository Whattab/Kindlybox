// First-party demand signal — KindlyBox's secret weapon.
//
// Tallies real quiz submissions (who people are actually shopping for, and for
// what occasion) over a recent window. A topic that matches high-demand
// recipients/occasions gets a `kindlybox_score` boost that Google can't see.

import { createServiceClient } from "@/utils/supabase/admin";

export interface FirstPartyDemand {
  total: number;
  windowDays: number;
  recipients: Record<string, number>;   // normalized 0..100, relative to top
  occasions: Record<string, number>;    // normalized 0..100, relative to top
  recipientPct: Record<string, number>; // raw % share (for "why now" evidence)
  occasionPct: Record<string, number>;
}

function tally(rows: { answers: any }[], key: string) {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const v = (r.answers?.[key] ?? "").toString().trim().toLowerCase();
    if (v) counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

function normalize(counts: Record<string, number>) {
  const top = Math.max(1, ...Object.values(counts));
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const scored: Record<string, number> = {};
  const pct: Record<string, number> = {};
  for (const [k, n] of Object.entries(counts)) {
    scored[k] = Math.round((n / top) * 100);
    pct[k] = Math.round((n / total) * 100);
  }
  return { scored, pct };
}

export async function getFirstPartyDemand(windowDays = 90): Promise<FirstPartyDemand> {
  const admin = createServiceClient();
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const { data } = await admin
    .from("quiz_sessions")
    .select("answers, created_at")
    .gte("created_at", since);

  const rows = data ?? [];
  const rec = normalize(tally(rows, "recipient"));
  const occ = normalize(tally(rows, "occasion"));
  return {
    total: rows.length,
    windowDays,
    recipients: rec.scored,
    occasions: occ.scored,
    recipientPct: rec.pct,
    occasionPct: occ.pct,
  };
}
