// AI-tag gift cards (2026-10-26). The Giftcards.com feed arrives tagged only
// "gift cards" (normalize.ts), so "Last-minute ideas" / "An experience instead"
// matched them loosely (a coffee lover got restaurant cards). This gives every
// active gift card real interests/occasions/recipients/style via tagItem, KEEPS
// the feed tags ("gift cards", "travel" — articles group on them), and sets
// gift_type: "physical" for mailed cards, "digital" for e-cards.
//
// Safe to re-run (it overwrites the AI fields each time). The nightly sync never
// touches tags of existing products, so the result sticks.
//
//   npx tsx scripts/ai-tag-gift-cards.ts --dry --limit 20   # preview, no writes
//   npx tsx scripts/ai-tag-gift-cards.ts                    # all active gift cards
//
// Flags: --limit N · --concurrency N (default 8) · --dry · --dev

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { tagItem } from "../src/lib/ai-tags";

const argVal = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };
const DRY = process.argv.includes("--dry");
const useDev = process.argv.includes("--dev");
const LIMIT = argVal("--limit") ? Math.max(1, parseInt(argVal("--limit")!, 10)) : Infinity;
const CONCURRENCY = Math.max(1, parseInt(argVal("--concurrency") || "8", 10) || 8);
const PAGE = 1000;
// Feed tags that aren't interests the AI would pick — always kept.
const FEED_TAGS = ["gift cards", "travel"];

// The vocabulary has no "dining out" interest, so without these rules the AI
// files every restaurant card under cooking/home & kitchen (a keen home cook
// would get a steakhouse voucher).
const GIFT_CARD_HINT = [
  "This PRODUCT is a GIFT CARD. Interests = what someone who'd LOVE this card is into, judged by what the BRAND mainly sells. At most 2 interests; none is a fine answer.",
  "- Restaurants, fast food, pizza, food delivery (DoorDash, Grubhub, Instacart): NEVER \"cooking\", \"home & kitchen\", \"baking\", \"grilling & bbq\" — those are for people who cook at home. Use \"coffee\" only for a coffee chain (Starbucks, Dunkin'), \"tea\" for a tea shop, \"wine & cocktails\" for a wine shop/bar/brewery; otherwise no interests.",
  "- Gas stations, groceries, pharmacies, convenience stores, department stores, prepaid phone cards, bitcoin, and multi-brand \"choice\" cards: no interests.",
  "- Otherwise tag the brand's specialty: bookstore → books & reading; game store/console store → gaming (+ console); cinema/streaming → movies & tv; spa/massage → self-care or recovery & massage; golf → golf; outdoor/fishing retailer → outdoor/ adventure; clothing → fashion & accessories (+ apparel); pet store → pets; music store → music & instruments; craft store → art & crafts; home goods → home decor.",
  "- \"experiences\" only for outings: cinemas, spas, golf, events/tickets, activity centres, theme parks, hotels/airlines/travel. Not for meals or shops.",
  "- Avoid flags: only \"no alcohol\" for alcohol sellers. Leave others empty.",
].join("\n");

config({ path: useDev ? ".env.dev.local" : ".env.local", override: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function fetchGiftCards(): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("products")
      .select("id, title, description, tags")
      .eq("active", true)
      .or("merchant_name.eq.Giftcards.com,title.ilike.%gift card%,title.ilike.%giftcard%,title.ilike.%egift%,title.ilike.%e-gift%")
      .order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function tagOne(p: any): Promise<{ ok: boolean; summary: string }> {
  try {
    // Title only: the feed descriptions are shared boilerplate whose words
    // ("coffee", "dinner") leaked into every card's tags.
    const t = await tagItem(p.title, null, db as any, GIFT_CARD_HINT);
    const interests = t.interests.slice(0, 2);
    const primary_interest = t.primary_interest && interests.includes(t.primary_interest) ? t.primary_interest : interests[0] || null;
    const kept = (p.tags || []).filter((x: string) => FEED_TAGS.includes(x));
    const tags = Array.from(new Set([...kept, ...interests]));
    const gift_type = /\bphysical\b/i.test(p.title) ? ["physical"] : ["digital"];
    if (!DRY) {
      const { error } = await db.from("products").update({
        tags, occasions: t.occasions, recipients: t.recipients,
        style: t.style, gift_type, avoid_flags: t.avoid_flags, primary_interest,
      }).eq("id", p.id);
      if (error) return { ok: false, summary: `✗ ${p.title.slice(0, 40)} — ${error.message}` };
    }
    return { ok: true, summary: `· ${p.title.slice(0, 40).padEnd(40)} [${interests.join(", ")}] occ=[${t.occasions.join(", ")}] who=[${t.recipients.join(", ")}] ${t.style.join(",")} ${gift_type[0]}` };
  } catch (e) {
    return { ok: false, summary: `✗ ${p.title.slice(0, 40)} — ${(e as any)?.message || e}` };
  }
}

async function main() {
  const all = await fetchGiftCards();
  const items = all.slice(0, Math.min(LIMIT, all.length));
  console.log(`${DRY ? "DRY RUN — " : ""}tagging ${items.length} of ${all.length} active gift cards${useDev ? " (dev)" : ""}, concurrency ${CONCURRENCY}…\n`);
  let idx = 0, done = 0, failed = 0;
  const t0 = Date.now();
  async function worker() {
    while (idx < items.length) {
      const r = await tagOne(items[idx++]);
      if (r.ok) done++; else failed++;
      console.log(r.summary);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  console.log(`\n${DRY ? "(dry run — nothing written) " : ""}tagged=${done} failed=${failed} in ${((Date.now() - t0) / 1000).toFixed(0)} s.`);
  if (failed > 0) console.log("Re-run to retry the failed rows.");
}

main().catch((e) => { console.error(e); process.exit(1); });
