// Re-tag the 64 curated gifts — cleans Step 4b's additive "magnet" interest tags
// (a gaming chair tagged home & kitchen, wind chimes tagged pets, a running watch
// tagged gaming, "books for mom", etc.).
//
// Scope: REPLACES interests (tags) + style + gift_type + avoid_flags +
// primary_interest. It deliberately PRESERVES the hand-curated occasions +
// recipients — the AI flattens those into a generic "birthday/holidays/just
// because" and narrows recipients wrongly, so for the curated core the existing
// values are better. (Product occasions/recipients, which ARE junk from the
// keyword normalizer, get the full AI replace in scripts/ai-tag-products.ts.)
//
// REVIEW-FIRST: prints a diff (current → proposed) and writes NOTHING unless you
// pass --apply, because these are the owner's curated core.
//
//   npx tsx scripts/retag-gifts.ts            # dry run — show the diff only
//   npx tsx scripts/retag-gifts.ts --apply    # write the proposed tags (PROD)
//
// Targets prod (.env.local — gifts live there); pass --dev for the dev DB.

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { tagItem } from "../src/lib/ai-tags";

const APPLY = process.argv.includes("--apply");
const useDev = process.argv.includes("--dev");
config({ path: useDev ? ".env.dev.local" : ".env.local", override: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const arr = (a: string[] | null | undefined) => (a && a.length ? a.join(", ") : "∅");
// Show removed (−) and added (+) between the current list and the proposed one.
function diff(label: string, cur: string[] | null | undefined, next: string[]): string | null {
  const c = new Set(cur || []), n = new Set(next);
  const removed = [...c].filter((x) => !n.has(x));
  const added = [...n].filter((x) => !c.has(x));
  if (!removed.length && !added.length) return null;
  return `    ${label}: ${arr(cur)}  →  ${arr(next)}` + (removed.length ? `   −[${removed.join(", ")}]` : "") + (added.length ? `   +[${added.join(", ")}]` : "");
}

async function main() {
  const { data: gifts, error } = await db
    .from("gifts")
    .select("id, name, description, tags, style, gift_type")
    .eq("active", true)
    .order("name");
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — cleaning interests/style on ${gifts?.length ?? 0} gifts (occasions/recipients preserved)${useDev ? " (dev)" : ""}…\n`);

  let applied = 0, changed = 0;
  for (const g of (gifts || []) as any[]) {
    const t = await tagItem(g.name, g.description, db as any);
    const lines = [
      diff("tags", g.tags, t.interests),
      diff("style", g.style, t.style),
    ].filter(Boolean);
    if (lines.length) {
      changed++;
      console.log(`• ${g.name.slice(0, 50)}  (primary=${t.primary_interest ?? "∅"}, type=${arr(t.gift_type)})`);
      for (const l of lines) console.log(l);
    }
    if (!APPLY) continue;
    // Preserve occasions + recipients (curated); replace interests + derived cols.
    const { error: uerr } = await db.from("gifts").update({
      tags: t.interests, style: t.style, gift_type: t.gift_type, avoid_flags: t.avoid_flags, primary_interest: t.primary_interest,
    }).eq("id", g.id);
    if (uerr) console.error(`  ✗ update failed: ${uerr.message}`); else applied++;
  }
  console.log(`\n${changed} gift(s) would change. ${APPLY ? `Applied to ${applied}.` : "(dry run — nothing written; re-run with --apply)"}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
