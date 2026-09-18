// One-off: re-derive tags for the existing affiliate catalogue in place, using
// the current tagging logic (merchant profiles + keyword rules) — no feed
// re-download. Only `tags` are rewritten; occasions/recipients/gender are left
// as-is. Also deactivates obvious non-products (shipping/insurance line items).
//
//   npx tsx scripts/retag-products.ts          # apply
//   npx tsx scripts/retag-products.ts --dry     # preview counts only
//
// Reversible: the next nightly sync re-normalises with the same logic anyway.

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { deriveAttributes } from "../src/lib/affiliate/normalize";

config({ path: ".env.local" });

const DRY = process.argv.includes("--dry");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

// Non-products some merchants list as SKUs (Mosaic sells "Shipping Insurance").
const JUNK_RX = /\b(shipping|insurance)\b/i;

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

async function main() {
  let from = 0;
  let scanned = 0;
  let changed = 0;
  let junk = 0;
  const changes: { id: string; tags: string[] }[] = [];
  const junkIds: string[] = [];

  for (;;) {
    const { data, error } = await db
      .from("products")
      .select("id, title, description, category, merchant_name, tags")
      .eq("active", true)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data.length) break;

    for (const p of data) {
      scanned++;
      if (JUNK_RX.test(p.title || "") && (p.title || "").length < 40) {
        junk++;
        junkIds.push(p.id);
        continue;
      }
      const hay = ` ${[p.title, p.category, p.description].filter(Boolean).join(" ").toLowerCase()} `;
      const { tags } = deriveAttributes(hay, p.merchant_name);
      if (!sameSet(tags, p.tags || [])) {
        changed++;
        changes.push({ id: p.id, tags });
      }
    }
    from += 1000;
    if (data.length < 1000) break;
  }

  console.log(`scanned ${scanned} active products`);
  console.log(`  tag changes: ${changed}`);
  console.log(`  junk rows to deactivate: ${junk}`);

  if (DRY) {
    console.log("\n--dry: no writes. Sample changes:");
    changes.slice(0, 12).forEach((c) => console.log("  ", c.id.slice(0, 8), "->", c.tags.join(", ") || "(none)"));
    return;
  }

  // Apply tag updates in parallel chunks.
  const now = new Date().toISOString();
  const CHUNK = 100;
  for (let i = 0; i < changes.length; i += CHUNK) {
    const batch = changes.slice(i, i + CHUNK);
    await Promise.all(
      batch.map((c) => db.from("products").update({ tags: c.tags, updated_at: now }).eq("id", c.id)),
    );
    process.stdout.write(`\r  updated ${Math.min(i + CHUNK, changes.length)}/${changes.length}`);
  }
  console.log("");

  // Deactivate junk line-items.
  for (let i = 0; i < junkIds.length; i += 200) {
    const batch = junkIds.slice(i, i + 200);
    await db.from("products").update({ active: false, updated_at: now }).in("id", batch);
  }

  console.log(`done. ${changed} retagged, ${junk} deactivated.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
