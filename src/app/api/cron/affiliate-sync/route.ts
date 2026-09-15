import { NextResponse } from "next/server";
import { syncAwin } from "@/lib/affiliate/sync";
import { syncCj } from "@/lib/affiliate/sync-cj";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // downloads + per-product image checks take a while

// Scheduled affiliate feed sync (Vercel Cron hits this daily).
//
// Auth: in production a CRON_SECRET is required — Vercel Cron sends it as
// `Authorization: Bearer <CRON_SECRET>` automatically. In local dev (no secret)
// it runs freely so we can test. It is NEVER open in production.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd || secret) {
    const auth = req.headers.get("authorization");
    const qs = new URL(req.url).searchParams.get("secret");
    if (!secret || (auth !== `Bearer ${secret}` && qs !== secret)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // Each network runs independently — one failing shouldn't stop the other.
  const results: Record<string, any> = {};
  try { results.awin = await syncAwin(); }
  catch (e: any) { results.awin = { error: e?.message }; }
  try { results.cj = await syncCj(); }
  catch (e: any) { results.cj = { error: e?.message }; }

  return NextResponse.json(results);
}
