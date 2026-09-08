import { NextResponse } from "next/server";
import { syncAwin } from "@/lib/affiliate/sync";

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

  try {
    const summary = await syncAwin();
    return NextResponse.json(summary);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message, stack: e?.stack?.split("\n").slice(0, 5) }, { status: 500 });
  }
}
