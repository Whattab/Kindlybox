// AI re-tag affiliate products into the taxonomy (tag-quality fix). REPLACES the
// keyword-normalizer tags/occasions/recipients (a "Gamer Name Wood Sign" tagged
// baby shower, Printerval apparel tagged across occasions) with AI-generated
// tags, and fills style/gift_type/avoid_flags/primary_interest (0% covered).
//
// RESUMABLE: processes approved+in-stock products WHERE ai_tagged_at IS NULL,
// stamps ai_tagged_at on success, so a long run survives restarts. Requires the
// 20261010_product_ai_tagged_at migration.
//
//   npx tsx scripts/ai-tag-products.ts --dry --limit 20      # preview, no writes
//   npx tsx scripts/ai-tag-products.ts --limit 500           # tag a batch
//   npx tsx scripts/ai-tag-products.ts                       # tag everything left
//   npx tsx scripts/ai-tag-products.ts --merchant "Printerval"
//
// Flags: --limit N (default: all) · --merchant X · --concurrency N (default 8)
//        · --dry · --dev (target the dev DB)

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { tagItem } from "../src/lib/ai-tags";

const argVal = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };
const DRY = process.argv.includes("--dry");
const useDev = process.argv.includes("--dev");
const LIMIT = argVal("--limit") ? Math.max(1, parseInt(argVal("--limit")!, 10)) : Infinity;
const MERCHANT = argVal("--merchant");
const CONCURRENCY = Math.max(1, parseInt(argVal("--concurrency") || "8", 10) || 8);
const PAGE = 500;

config({ path: useDev ? ".env.dev.local" : ".env.local", override: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function remainingCount(): Promise<number> {
  let q = db.from("products").select("id", { count: "exact", head: true })
    .eq("active", true).eq("in_stock", true).eq("status", "approved").is("ai_tagged_at", null);
  if (MERCHANT) q = q.eq("merchant_name", MERCHANT);
  const { count } = await q;
  return count || 0;
}

async function nextBatch(size: number): Promise<any[]> {
  let q = db.from("products").select("id, title, description")
    .eq("active", true).eq("in_stock", true).eq("status", "approved").is("ai_tagged_at", null)
    .order("id").limit(size);
  if (MERCHANT) q = q.eq("merchant_name", MERCHANT);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

async function tagOne(p: any): Promise<{ ok: boolean; summary: string }> {
  try {
    const t = await tagItem(p.title, p.description, db as any);
    if (!DRY) {
      const { error } = await db.from("products").update({
        tags: t.interests, occasions: t.occasions, recipients: t.recipients,
        style: t.style, gift_type: t.gift_type, avoid_flags: t.avoid_flags,
        primary_interest: t.primary_interest, ai_tagged_at: new Date().toISOString(),
      }).eq("id", p.id);
      if (error) return { ok: false, summary: `✗ ${p.title.slice(0, 40)} — ${error.message}` };
    }
    return { ok: true, summary: `· ${p.title.slice(0, 44).padEnd(44)} [${t.interests.join(",")}] occ=[${t.occasions.join(",")}] ${t.style.join(",")}` };
  } catch (e) {
    return { ok: false, summary: `✗ ${p.title.slice(0, 40)} — ${(e as any)?.message || e}` };
  }
}

// Run a batch with bounded concurrency (a simple worker pool).
async function runPool(items: any[]): Promise<{ done: number; failed: number }> {
  let idx = 0, done = 0, failed = 0;
  async function worker() {
    while (idx < items.length) {
      const p = items[idx++];
      const r = await tagOne(p);
      if (r.ok) done++; else { failed++; console.error(r.summary); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  return { done, failed };
}

async function main() {
  const total = await remainingCount();
  const target = Math.min(LIMIT, total);
  console.log(`${DRY ? "DRY RUN — " : ""}re-tagging up to ${target} of ${total} untagged products${MERCHANT ? ` (merchant=${MERCHANT})` : ""}${useDev ? " (dev)" : ""}, concurrency ${CONCURRENCY}…\n`);
  if (target === 0) { console.log("Nothing to do — all matching products are tagged."); return; }

  let processed = 0, done = 0, failed = 0;
  const t0 = Date.now();
  while (processed < target) {
    const batch = await nextBatch(Math.min(PAGE, target - processed));
    if (batch.length === 0) break;
    const r = await runPool(batch);
    done += r.done; failed += r.failed; processed += batch.length;
    const rate = processed / ((Date.now() - t0) / 1000);
    console.log(`  … ${processed}/${target} done=${done} failed=${failed} (${rate.toFixed(1)}/s)`);
    if (DRY) break; // one page is enough to sanity-check
  }
  console.log(`\n${DRY ? "(dry run — nothing written; one page shown)" : `Done. tagged=${done} failed=${failed} in ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min.`}`);
  if (!DRY && failed > 0) console.log("Failed rows kept ai_tagged_at=NULL — just re-run to retry them.");
}

main().catch((e) => { console.error(e); process.exit(1); });
