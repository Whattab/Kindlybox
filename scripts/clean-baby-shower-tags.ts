// Deterministic cleanup: strip "baby shower" from products whose title shows a
// clearly NON-newborn theme (sports, gaming, adult hobbies, adult relationships).
// The keyword normalizer tagged many name signs / novelty items as baby shower
// ("Gamer Name Wood Sign", "Girl Dad Tee"); Gemini Flash won't reliably drop
// these, so a whole-word rule does it cheaply and predictably.
//
//   npx tsx scripts/clean-baby-shower-tags.ts            # dry run — show matches
//   npx tsx scripts/clean-baby-shower-tags.ts --apply    # write the change
//   (--dev targets the dev DB)
//
// Conservative by design: only removes "baby shower" (keeps all other occasions)
// and only when a disqualifying word is present, so genuine nursery items
// (princess, rainbow, animals, "baby …") are untouched.

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const useDev = process.argv.includes("--dev");
config({ path: useDev ? ".env.dev.local" : ".env.local", override: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Themes that make an item clearly not a newborn/nursery gift.
const DISQUALIFY = [
  // sports
  "basketball", "football", "soccer", "volleyball", "baseball", "softball", "hockey", "tennis",
  "golf", "lacrosse", "wrestling", "boxing", "rugby", "cricket", "bowling", "skateboard", "skater",
  // gaming / tech-hobby
  "gamer", "gaming", "xbox", "playstation", "nintendo", "esports", "controller", "console",
  // adult hobbies / themes
  "beer", "whiskey", "whisky", "bourbon", "vodka", "tequila", "cocktail", "bbq", "grill", "grilling",
  "hunting", "hunter", "fishing", "fisherman", "motorcycle", "biker", "poker", "guitar", "drummer",
  "firearm", "rifle", "ammo", "horror", "skull", "tattoo",
  // adult relationships / roles (not a newborn)
  "husband", "wife", "boyfriend", "girlfriend", "fiance", "fiancee", "grandpa", "grandma",
  "grandfather", "grandmother", "father's day", "mother's day", "girl dad", "dog dad", "cat dad", "dog mom", "cat mom",
];
// Apparel/jewelry are only baby-shower gifts if they're actually infant-sized.
const APPAREL_TAGS = ["apparel", "fashion & accessories", "jewelry"];
const INFANT_WORDS = ["onesie", "bodysuit", "romper", "newborn", "infant", "swaddle", "bib", "teether",
  "pacifier", "crib", "nursery", "0-3 month", "3-6 month", "6-9 month", "12 month", "18 month", "24 month", "layette"];
const norm = (s: string) => " " + (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim() + " ";
const hasWord = (hay: string, w: string) => hay.includes(norm(w));
const anyWord = (hay: string, ws: string[]) => ws.some((w) => hasWord(hay, w));

async function main() {
  // Page through all approved+active products tagged baby shower.
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("products")
      .select("id, title, occasions, tags")
      .eq("active", true).eq("status", "approved").contains("occasions", ["baby shower"])
      .order("id").range(from, from + 999);
    if (error) { console.error(error.message); process.exit(1); }
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const hits = rows.filter((p) => {
    const h = norm(p.title);
    if (anyWord(h, DISQUALIFY)) return true;
    // Apparel/jewelry tagged baby shower but not actually infant-sized → not a baby gift.
    const isApparel = (p.tags || []).some((t: string) => APPAREL_TAGS.includes(t));
    if (isApparel && !anyWord(h, INFANT_WORDS)) return true;
    return false;
  });
  console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${rows.length} products tagged "baby shower"; ${hits.length} have a non-newborn theme${useDev ? " (dev)" : ""}.\n`);
  for (const p of hits.slice(0, 60)) console.log(`  − ${p.title.slice(0, 60)}`);
  if (hits.length > 60) console.log(`  … and ${hits.length - 60} more`);

  if (!APPLY) { console.log(`\n(dry run — nothing written; re-run with --apply)`); return; }
  let applied = 0;
  for (const p of hits) {
    const next = (p.occasions || []).filter((o: string) => o !== "baby shower");
    const { error } = await db.from("products").update({ occasions: next }).eq("id", p.id);
    if (error) console.error(`  ✗ ${p.title.slice(0, 40)} — ${error.message}`); else applied++;
  }
  console.log(`\nRemoved "baby shower" from ${applied} products.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
