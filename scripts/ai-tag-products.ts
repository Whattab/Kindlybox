// AI re-tag affiliate products into the taxonomy (tag-quality fix). REPLACES the
// keyword-normalizer tags/occasions/recipients (a "Gamer Name Wood Sign" tagged
// baby shower, Printerval apparel tagged across occasions) with AI-generated
// tags, and fills style/gift_type/avoid_flags/primary_interest (0% covered).
//
// RESUMABLE: processes approved+in-stock products WHERE ai_tagged_at IS NULL,
// stamps ai_tagged_at on success, so a long run survives restarts. Requires the
// 20261010_product_ai_tagged_at migration.
//
//   npx tsx scripts/ai-tag-products.ts --dry --gated --limit 20   # preview, no writes
//   npx tsx scripts/ai-tag-products.ts --gated                    # the 1.6k gated-occasion set
//   npx tsx scripts/ai-tag-products.ts --limit 500                # a batch (marker mode)
//   npx tsx scripts/ai-tag-products.ts                            # everything left (needs ai_tagged_at)
//
// Modes:
//  --gated : only products carrying a GATED occasion (baby shower / wedding /
//            graduation / promotion-retirement) — the ones that pollute the
//            occasion gating. Self-limiting + needs no ai_tagged_at column
//            (fetches the target set up front, processes in one pass).
//  default : all approved+in-stock, resumable via ai_tagged_at IS NULL (needs
//            the 20261010 migration).
//
// Flags: --limit N · --merchant X · --concurrency N (default 8) · --dry · --dev

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { tagItem } from "../src/lib/ai-tags";

const argVal = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };
const DRY = process.argv.includes("--dry");
const GATED = process.argv.includes("--gated");
const useDev = process.argv.includes("--dev");
const LIMIT = argVal("--limit") ? Math.max(1, parseInt(argVal("--limit")!, 10)) : Infinity;
const MERCHANT = argVal("--merchant");
const CONCURRENCY = Math.max(1, parseInt(argVal("--concurrency") || "8", 10) || 8);
const PAGE = 500;
const GATED_OCCASIONS = ["baby shower", "wedding", "graduation", "promotion/retirement"];

config({ path: useDev ? ".env.dev.local" : ".env.local", override: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const scope = (q: any) => {
  q = q.eq("active", true).eq("in_stock", true).eq("status", "approved");
  if (MERCHANT) q = q.eq("merchant_name", MERCHANT);
  if (GATED) q = q.overlaps("occasions", GATED_OCCASIONS); else q = q.is("ai_tagged_at", null);
  return q;
};

async function remainingCount(): Promise<number> {
  const { count } = await scope(db.from("products").select("id", { count: "exact", head: true }));
  return count || 0;
}

async function nextBatch(size: number): Promise<any[]> {
  const { data, error } = await scope(db.from("products").select("id, title, description")).order("id").limit(size);
  if (error) throw new Error(error.message);
  return data || [];
}

// --gated: fetch the whole target set up front (paginated reads), so a single
// pass handles it and we never depend on a resume marker.
async function fetchAllGated(cap: number): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; out.length < cap; from += PAGE) {
    const { data, error } = await scope(db.from("products").select("id, title, description")).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out.slice(0, cap);
}

async function tagOne(p: any): Promise<{ ok: boolean; summary: string }> {
  try {
    const t = await tagItem(p.title, p.description, db as any);
    if (!DRY) {
      const update: any = {
        tags: t.interests, occasions: t.occasions, recipients: t.recipients,
        style: t.style, gift_type: t.gift_type, avoid_flags: t.avoid_flags, primary_interest: t.primary_interest,
      };
      if (!GATED) update.ai_tagged_at = new Date().toISOString(); // marker only in default mode
      const { error } = await db.from("products").update(update).eq("id", p.id);
      if (error) return { ok: false, summary: `✗ ${p.title.slice(0, 40)} — ${error.message}` };
    }
    return { ok: true, summary: `· ${p.title.slice(0, 44).padEnd(44)} [${t.interests.join(",")}] occ=[${t.occasions.join(",")}] ${t.style.join(",")}` };
  } catch (e) {
    return { ok: false, summary: `✗ ${p.title.slice(0, 40)} — ${(e as any)?.message || e}` };
  }
}

// Run a batch with bounded concurrency (a simple worker pool).
async function runPool(items: any[], onProgress?: (processed: number) => void): Promise<{ done: number; failed: number }> {
  let idx = 0, done = 0, failed = 0, processed = 0;
  async function worker() {
    while (idx < items.length) {
      const p = items[idx++];
      const r = await tagOne(p);
      if (r.ok) { done++; if (DRY) console.log(r.summary); } else { failed++; console.error(r.summary); }
      onProgress?.(++processed);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  return { done, failed };
}

async function main() {
  const total = await remainingCount();
  const target = Math.min(LIMIT, total);
  console.log(`${DRY ? "DRY RUN — " : ""}re-tagging up to ${target} of ${total} ${GATED ? "gated-occasion" : "untagged"} products${MERCHANT ? ` (merchant=${MERCHANT})` : ""}${useDev ? " (dev)" : ""}, concurrency ${CONCURRENCY}…\n`);
  if (target === 0) { console.log("Nothing to do."); return; }

  let processed = 0, done = 0, failed = 0;
  const t0 = Date.now();
  const report = () => console.log(`  … ${processed}/${target} done=${done} failed=${failed} (${(processed / ((Date.now() - t0) / 1000)).toFixed(1)}/s)`);

  if (GATED) {
    // Fetch the whole target set up front, then process in one concurrent pass.
    const items = await fetchAllGated(target);
    if (DRY) items.splice(20); // preview only the first 20
    const r = await runPool(items, (n) => { processed = n; if (n % 100 === 0) report(); });
    done = r.done; failed = r.failed; processed = items.length;
  } else {
    while (processed < target) {
      const batch = await nextBatch(Math.min(PAGE, target - processed));
      if (batch.length === 0) break;
      const r = await runPool(batch);
      done += r.done; failed += r.failed; processed += batch.length;
      report();
      if (DRY) break;
    }
  }
  console.log(`\n${DRY ? "(dry run — nothing written)" : `Done. tagged=${done} failed=${failed} in ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min.`}`);
  if (!DRY && failed > 0 && !GATED) console.log("Failed rows kept ai_tagged_at=NULL — just re-run to retry them.");
}

main().catch((e) => { console.error(e); process.exit(1); });
