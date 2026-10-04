// /go/s/[id] — tracked outbound redirect for a quiz pick (Step 2).
//
// `id` is a gift_suggestions.id. We resolve the pick's real destination, append
// the network sub-tracking param (carrying the quiz-path key), log the click,
// and 302 out. Logging is fail-soft: a logging error never blocks the redirect.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/admin";
import { appendTrackingParams, clickSubtag } from "@/lib/affiliate/tracking";

export const dynamic = "force-dynamic"; // never cache redirects

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const db = createServiceClient();

  const { data: sug } = await db
    .from("gift_suggestions")
    .select("id, session_id, source, gift_id, product_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!sug) {
    return NextResponse.redirect(
      new URL("/?message=That+gift+link+is+no+longer+available.", request.url),
    );
  }

  const isProduct = sug.source === "product" || (!!sug.product_id && !sug.gift_id);
  let destination: string | null = null;
  let network: string | null = null;
  let name: string | undefined;

  if (isProduct && sug.product_id) {
    const { data: p } = await db
      .from("products")
      .select("title, affiliate_link, network")
      .eq("id", sug.product_id)
      .maybeSingle();
    if (p) {
      destination = p.affiliate_link;
      network = p.network;
      name = p.title;
    }
  } else if (sug.gift_id) {
    const { data: g } = await db
      .from("gifts")
      .select("name, destination_url, affiliate_url, affiliate_network")
      .eq("id", sug.gift_id)
      .maybeSingle();
    if (g) {
      network = g.affiliate_network;
      name = g.name;
      // Prefer a real destination; some gifts store "/go/<slug>" in affiliate_url,
      // which is not a real outbound URL, so only use it when absolute.
      destination = g.destination_url || (/^https?:\/\//i.test(g.affiliate_url || "") ? g.affiliate_url : null);
    }
  }

  // No real destination yet → soft "coming soon" bounce (mirrors /go/[slug]).
  if (!destination) {
    return NextResponse.redirect(
      new URL(
        `/?message=${encodeURIComponent(`${name || "This gift"} — coming soon. We're sourcing this gift now.`)}`,
        request.url,
      ),
    );
  }

  const subtag = clickSubtag(sug.id);
  const finalUrl = appendTrackingParams(destination, network, subtag);

  try {
    await db.from("affiliate_clicks").insert({
      session_id: sug.session_id,
      suggestion_id: sug.id,
      source: isProduct ? "product" : "gift",
      gift_id: sug.gift_id,
      product_id: sug.product_id,
      network,
      subtag,
      destination: finalUrl,
    });
    // First-click timestamp on the suggestion (only set once).
    await db
      .from("gift_suggestions")
      .update({ clicked_at: new Date().toISOString() })
      .eq("id", sug.id)
      .is("clicked_at", null);
  } catch (e) {
    console.error("[go/s] click log failed (continuing):", (e as any)?.message || e);
  }

  return NextResponse.redirect(finalUrl, 302);
}
