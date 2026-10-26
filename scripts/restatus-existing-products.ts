// One-time: apply the two-tier blocklist to EXISTING products' status (Step 3c).
// After the migration defaults every product to 'approved', this re-stamps the
// ones that should not be auto-approved:
//   hard-blocked / trademark-on-untrusted → rejected
//   review-flagged (mild profanity / partisan / rec-drugs) → staged
//   everything else → left approved
// Only currently-approved rows change (2026-10-26): owner rejections stand.
//
//   npx tsx scripts/restatus-existing-products.ts --dry    # counts only (DEV)
//   npx tsx scripts/restatus-existing-products.ts          # apply (DEV)
//   npx tsx scripts/restatus-existing-products.ts --prod   # apply to PROD
//
// Safe to re-run (idempotent).

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { isHardBlocked, isReviewFlagged, isTrademarkBlocked } from "../src/lib/affiliate/blocklist";
import { isTrustedMerchant } from "../src/lib/affiliate/trusted-merchants";

const DRY = process.argv.includes("--dry");
const PROD = process.argv.includes("--prod");
config({ path: PROD ? ".env.local" : ".env.dev.local", override: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

function target(title: string, merchant: string | null): "rejected" | "staged" | "approved" {
  const trusted = isTrustedMerchant(merchant);
  if (isHardBlocked(title) || (isTrademarkBlocked(title) && !trusted)) return "rejected";
  if (isReviewFlagged(title)) return "staged";
  return "approved";
}

async function updateIn(ids: string[], status: string) {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db.from("products").update({ status }).in("id", ids.slice(i, i + 200));
    if (error) throw new Error(`update ${status} failed: ${error.message}`);
  }
}

async function main() {
  console.log(`Re-status existing products → ${PROD ? "PROD" : "DEV"}${DRY ? " (dry run)" : ""}`);
  const reject: string[] = [];
  const stage: string[] = [];
  const hits: string[] = [];
  let scanned = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("products")
      .select("id, title, merchant_name, status")
      .eq("active", true)
      .range(from, from + 999);
    if (error) { console.error(error.message); break; }
    const rows = data || [];
    for (const r of rows as any[]) {
      scanned++;
      const t = target(r.title, r.merchant_name);
      // Only APPROVED rows move: never un-reject a product, never re-stage one
      // that's already waiting for review.
      if (r.status !== "approved") continue;
      if (t === "rejected") { reject.push(r.id); hits.push(`reject  ${r.merchant_name} | ${r.title}`); }
      else if (t === "staged") { stage.push(r.id); hits.push(`stage   ${r.merchant_name} | ${r.title}`); }
    }
    if (rows.length < 1000) break;
  }

  console.log(`scanned ${scanned} active products`);
  console.log(`  → reject: ${reject.length}`);
  console.log(`  → stage:  ${stage.length}`);
  console.log(`  → leave approved: ${scanned - reject.length - stage.length}`);

  if (DRY) { hits.sort().forEach((h) => console.log("  " + h)); console.log("\n(dry run — no changes written)"); return; }
  if (reject.length) await updateIn(reject, "rejected");
  if (stage.length) await updateIn(stage, "staged");
  console.log(`\nApplied: ${reject.length} rejected, ${stage.length} staged.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
