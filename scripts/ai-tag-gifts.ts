// AI-tag the curated gifts into the taxonomy (Step 4b). For each active gift,
// tagItem() suggests interests (incl. sub-interests), style, gift_type,
// avoid_flags and a primary_interest — all restricted to the approved vocabulary.
// Interests are MERGED into gifts.tags (existing top-level kept), so the live
// quiz never regresses; the new columns are set outright.
//
//   npx tsx scripts/ai-tag-gifts.ts --dry    # print proposed tags only
//   npx tsx scripts/ai-tag-gifts.ts          # apply (PROD — gifts live there)
//
// Idempotent-ish: re-running re-tags from the current title/description.

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { tagItem } from "../src/lib/ai-tags";

const DRY = process.argv.includes("--dry");
config({ path: ".env.local", override: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  const { data: gifts, error } = await db.from("gifts").select("id, name, description, tags").eq("active", true);
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`${DRY ? "DRY RUN — " : ""}tagging ${gifts?.length ?? 0} active gifts…\n`);
  let applied = 0;
  for (const g of (gifts || []) as any[]) {
    const t = await tagItem(g.name, g.description, db as any);
    const mergedTags = Array.from(new Set([...(g.tags || []), ...t.interests]));
    const added = t.interests.filter((i) => !(g.tags || []).includes(i));
    console.log(`• ${g.name.slice(0, 48).padEnd(48)} +[${added.join(", ")}] primary=${t.primary_interest} style=[${t.style.join(",")}] type=[${t.gift_type.join(",")}]${t.avoid_flags.length ? " avoid=[" + t.avoid_flags.join(",") + "]" : ""}`);
    if (DRY) continue;
    const { error: uerr } = await db.from("gifts").update({
      tags: mergedTags,
      style: t.style,
      gift_type: t.gift_type,
      avoid_flags: t.avoid_flags,
      primary_interest: t.primary_interest,
    }).eq("id", g.id);
    if (uerr) console.error(`  ✗ update failed: ${uerr.message}`);
    else applied++;
  }
  console.log(`\n${DRY ? "(dry run — nothing written)" : `Applied to ${applied} gifts.`}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
