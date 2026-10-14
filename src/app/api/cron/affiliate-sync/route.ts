import { NextResponse } from "next/server";
import { syncAwin } from "@/lib/affiliate/sync";
import { syncCj } from "@/lib/affiliate/sync-cj";
import { syncRakuten } from "@/lib/affiliate/sync-rakuten";
import { createServiceClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // downloads + per-product image checks take a while

// Scheduled affiliate feed sync (Vercel Cron hits this daily).
//
// Auth: in production a CRON_SECRET is required — Vercel Cron sends it as
// `Authorization: Bearer <CRON_SECRET>` automatically, but ONLY when the
// CRON_SECRET env var exists on the project. In local dev (no secret) it runs
// freely so we can test. It is NEVER open in production.
//
// Failures are logged to affiliate_sync_runs (status "error"), so a stalled
// sync shows up on the Products dashboard instead of failing silently — which
// is how it went unnoticed from Sep to Oct 2026 (CRON_SECRET was never set).

// Best-effort error row; never let logging mask the real result.
async function logFailure(network: string, message: string) {
  try {
    const now = new Date().toISOString();
    await createServiceClient().from("affiliate_sync_runs").insert({
      network, status: "error", imported: 0, deactivated: 0, feeds_processed: 0,
      detail: { error: message }, started_at: now, finished_at: now,
    });
  } catch (e) {
    console.error("[affiliate-sync] could not log failure:", e);
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !secret) {
    // Misconfiguration, not an intruder: say so loudly and record it.
    console.error("[affiliate-sync] CRON_SECRET is not set — nightly sync cannot authenticate");
    await logFailure("all", "CRON_SECRET is not set on Vercel — add it so the nightly sync can run");
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  if (secret) {
    const auth = req.headers.get("authorization");
    const qs = new URL(req.url).searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && qs !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // Each network runs independently — one failing shouldn't stop the others.
  const jobs: [string, () => Promise<unknown>][] = [["awin", syncAwin], ["cj", syncCj], ["rakuten", syncRakuten]];
  const results: Record<string, unknown> = {};
  for (const [network, run] of jobs) {
    try {
      results[network] = await run();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results[network] = { error: message };
      await logFailure(network, message);
    }
  }

  return NextResponse.json(results);
}
