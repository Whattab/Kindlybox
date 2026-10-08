// AI-tag affiliate products into the taxonomy (Step 4b) — SELECTIVE, to control
// Gemini cost (the catalogue has ~11.5k products). Filter down, then tag. Same
// tagItem() as gifts: interests merged into products.tags, new columns set.
//
//   npx tsx scripts/ai-tag-products.ts --dry --limit 20
//   npx tsx scripts/ai-tag-products.ts --merchant "Printerval" --limit 200
//   npx tsx scripts/ai-tag-products.ts --category "Flowers" --status approved --limit 500
//
// Flags: --limit N (default 100) · --merchant X · --category X · --status X · --dry

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { tagItem } from "../src/lib/ai-tags";

const argVal = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };
const DRY = process.argv.includes("--dry");
const LIMIT = Math.max(1, parseInt(argVal("--limit") || "100", 10) || 100);
const MERCHANT = argVal("--merchant");
const CATEGORY = argVal("--category");
const STATUS = argVal("--status");

config({ path: ".env.local", override: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  let q = db.from("products").select("id, title, description, tags").eq("active", true);
  if (MERCHANT) q = q.eq("merchant_name", MERCHANT);
  if (CATEGORY) q = q.eq("category", CATEGORY);
  if (STATUS) q = q.eq("status", STATUS);
  const { data: products, error } = await q.limit(LIMIT);
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`${DRY ? "DRY RUN — " : ""}tagging ${products?.length ?? 0} products (limit ${LIMIT}${MERCHANT ? `, merchant=${MERCHANT}` : ""}${CATEGORY ? `, category=${CATEGORY}` : ""}${STATUS ? `, status=${STATUS}` : ""})…\n`);
  let applied = 0;
  for (const p of (products || []) as any[]) {
    const t = await tagItem(p.title, p.description, db as any);
    const mergedTags = Array.from(new Set([...(p.tags || []), ...t.interests]));
    const added = t.interests.filter((i) => !(p.tags || []).includes(i));
    console.log(`• ${p.title.slice(0, 48).padEnd(48)} +[${added.join(", ")}] primary=${t.primary_interest} style=[${t.style.join(",")}]`);
    if (DRY) continue;
    const { error: uerr } = await db.from("products").update({
      tags: mergedTags, style: t.style, gift_type: t.gift_type, avoid_flags: t.avoid_flags, primary_interest: t.primary_interest,
    }).eq("id", p.id);
    if (uerr) console.error(`  ✗ ${uerr.message}`); else applied++;
  }
  console.log(`\n${DRY ? "(dry run — nothing written)" : `Applied to ${applied} products.`}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
