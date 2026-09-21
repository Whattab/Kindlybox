// One-off: create content opportunities for a fixed list of gift-guide topics,
// then generate an outline + full article DRAFT for each (using the real
// writer.ts pipeline, so matching/prose stay identical to the dashboard).
//
// Idempotent: reuses an existing opportunity with the same title, and skips a
// topic that already has an article. Articles are left in DRAFT for review —
// nothing is published.
//
//   npx tsx scripts/generate-articles.ts

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { generateOutline, writeFromOutline } from "../src/lib/intelligence/writer";

config({ path: ".env.local" });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const TOPICS: { title: string; keyword: string; why: string }[] = [
  { title: "25 Birthday Gifts for Her", keyword: "birthday gifts for her", why: "Birthdays are an evergreen, high-intent gifting occasion." },
  { title: "20 Birthday Gifts for Him", keyword: "birthday gifts for him", why: "Birthdays are an evergreen, high-intent gifting occasion." },
  { title: "Best Gifts for Mom", keyword: "gifts for mom", why: "Steady year-round demand, peaking around Mother's Day." },
  { title: "Best Gifts for Dad", keyword: "gifts for dad", why: "Steady year-round demand, peaking around Father's Day." },
  { title: "Gifts for New Parents", keyword: "gifts for new parents", why: "Baby showers and new arrivals drive constant gifting." },
  { title: "Gifts Under $25", keyword: "gifts under $25", why: "Budget gift guides convert well for last-minute and secret-santa shoppers." },
  { title: "Gifts Under $50", keyword: "gifts under $50", why: "A broad, high-traffic budget bracket for most occasions." },
  { title: "Best Valentine's Day Gifts", keyword: "valentine's day gifts", why: "Sharp seasonal spike in January–February." },
  { title: "Best Christmas Gifts", keyword: "christmas gifts", why: "The largest gifting season of the year (Q4)." },
  { title: "Best Gifts for People Who Have Everything", keyword: "gifts for people who have everything", why: "Popular evergreen search for hard-to-shop-for recipients." },
];

async function ensureOpportunity(t: { title: string; keyword: string; why: string }): Promise<string> {
  const { data: existing } = await db
    .from("content_opportunities")
    .select("id")
    .eq("suggested_title", t.title)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await db
    .from("content_opportunities")
    .insert({
      topic: t.title,
      suggested_title: t.title,
      content_type: "listicle",
      primary_keyword: t.keyword,
      secondary_keywords: [],
      why_now: t.why,
      search_score: 60, growth_score: 55, competition_score: 60, affiliate_score: 65,
      seasonal_score: 50, kindlybox_score: 85, freshness_score: 100, overall_score: 66,
      score_breakdown: {}, recommended_products: [], recommended_links: [],
      status: "APPROVED", approved_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`opportunity insert failed: ${error.message}`);
  return data.id;
}

async function main() {
  for (const t of TOPICS) {
    process.stdout.write(`\n• ${t.title}\n`);
    try {
      const oppId = await ensureOpportunity(t);

      const { data: already } = await db.from("articles").select("id, status").eq("opportunity_id", oppId).maybeSingle();
      if (already) {
        console.log(`    skip — article already exists (${already.status})`);
        continue;
      }

      const plan = await generateOutline(oppId);
      const { data: art, error } = await db
        .from("articles")
        .insert({ ...plan, opportunity_id: oppId, body: "", status: "OUTLINE", generated_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error) throw new Error(`article insert failed: ${error.message}`);

      const written = await writeFromOutline(art.id);
      await db
        .from("articles")
        .update({
          body: written.body,
          product_blocks: written.product_blocks,
          generated_by: written.generated_by,
          generated_at: new Date().toISOString(),
          status: "DRAFT",
          updated_at: new Date().toISOString(),
        })
        .eq("id", art.id);
      await db.from("content_opportunities").update({ status: "WRITING", updated_at: new Date().toISOString() }).eq("id", oppId);

      const prods = written.product_blocks.length;
      const merchants = new Set(written.product_blocks.map((b: any) => b.name)).size;
      console.log(`    ✓ DRAFT — ${written.body.length} chars, ${prods} products (${written.generated_by}) [slug: ${plan.slug}]`);
    } catch (e: any) {
      console.log(`    ✗ ${e?.message || e}`);
    }
    await new Promise((r) => setTimeout(r, 1500)); // gentle on the Gemini rate limit
  }
  console.log("\nDone. Review drafts at /dashboard/articles, then publish the good ones.");
}

main().catch((e) => { console.error(e); process.exit(1); });
