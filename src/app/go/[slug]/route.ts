// /go/[slug] — redirects the user to a gift's real destination URL.
//
// Currently a single source of truth for affiliate-link destinations:
// every gift card on the results page and email points at /go/<slug>.
// When you later get affiliate accounts, you just append your tag query
// param to each `destination_url` in the DB — no code or seed changes needed.

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic"; // we never cache redirects

export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const supabase = createClient();

  const { data: gift, error } = await supabase
    .from("gifts")
    .select("id, name, destination_url")
    .eq("slug", params.slug)
    .maybeSingle();

  // Unknown slug — bounce to home with a soft message
  if (error || !gift) {
    return NextResponse.redirect(
      new URL("/?message=That+gift+link+is+no+longer+available.", request.url),
    );
  }

  // Slug exists but no destination set yet
  if (!gift.destination_url) {
    return NextResponse.redirect(
      new URL(
        `/?message=${encodeURIComponent(
          `${gift.name} — coming soon. We're sourcing this gift now.`,
        )}`,
        request.url,
      ),
    );
  }

  // 302 (temporary) so we can swap destination_url later without browsers
  // caching the old URL forever.
  return NextResponse.redirect(gift.destination_url, 302);
}
