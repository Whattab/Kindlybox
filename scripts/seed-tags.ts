// Seed the tag taxonomy (Step 3a). Encodes the vocabulary from quiz-decisions.md
// §2 and upserts it into `tags` + `tag_synonyms`. Idempotent (upsert on slug /
// (phrase,tag_id)). Row inserts run via the service role.
//
//   npx tsx scripts/seed-tags.ts          # targets DEV (.env.dev.local)
//   npx tsx scripts/seed-tags.ts --prod   # targets PROD (.env.local)
//
// Reruns are safe: it re-asserts the same rows.

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const PROD = process.argv.includes("--prod");
config({ path: PROD ? ".env.local" : ".env.dev.local", override: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

// ltree-safe slug: lowercase, '+' → '_plus', any run of non-alphanumerics → '_'.
const slugify = (s: string) =>
  s.toLowerCase().replace(/\+/g, "_plus").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

// ── Interest tree (hierarchical). Key = root label, value = child labels. ──
const INTERESTS: Record<string, string[]> = {
  "tech & gadgets": ["audio", "smart home", "photography", "wearables", "charging & power"],
  "fashion & accessories": ["jewelry", "watches", "apparel", "bags", "scarves & wraps", "wallets"],
  "books & reading": ["fiction", "non-fiction", "cookbooks", "kids' books", "journals & stationery"],
  "home & kitchen": ["coffee", "tea", "cooking", "baking", "grilling & bbq", "wine & cocktails", "kitchen tools"],
  "fitness & wellness": ["yoga", "strength & gym", "recovery & massage", "self-care", "sleep", "meditation"],
  "outdoor/ adventure": ["hiking", "camping", "fishing", "cycling", "golf"],
  "art & crafts": ["painting & drawing", "knitting & sewing", "diy kits", "pottery"],
  "music & instruments": ["guitar", "keys & piano", "vinyl & records", "audio production"],
  gaming: ["console", "pc gaming", "board games", "streaming gear"],
  gardening: ["indoor plants", "outdoor garden", "seeds & bulbs", "garden tools", "flowers"],
  "movies & tv": ["home cinema", "fandom & collectibles"],
  travel: ["luggage", "travel accessories", "experiences"],
  pets: ["dogs", "cats", "pet tech"],
  "home decor": ["candles", "wall art", "lighting", "textiles & rugs", "vases & planters", "ornaments"],
};

// ── Flat dimensions (no hierarchy). ──
const FLAT: Record<string, string[]> = {
  recipient: ["him", "her", "parent", "child", "sibling", "co-worker", "teacher/mentor", "friend"],
  life_stage: ["baby", "toddler", "kid", "tween", "teen", "20s", "30s-40s", "50s-60s", "70+"],
  occasion: ["birthday", "anniversary", "graduation", "baby shower", "wedding", "valentine's day", "promotion/retirement", "house warming", "mother's day", "father's day", "holidays", "thank you", "sympathy", "just because"],
  style: ["practical", "sentimental", "luxe", "fun & quirky", "experience"],
  gift_type: ["physical", "consumable", "experience", "personalized", "digital"],
  experience_level: ["beginner", "enthusiast", "expert"],
  avoid_flag: ["no alcohol", "minimalist", "has everything", "scent-sensitive", "dietary needs", "not into tech"],
};

// ── Synonyms: tag slug → phrases (for Step 4 free-text interpretation). ──
const SYNONYMS: Record<string, string[]> = {
  coffee: ["barista", "espresso", "latte", "cappuccino", "coffee lover", "caffeine"],
  tea: ["tea lover", "matcha", "chai"],
  baking: ["baker", "sourdough", "bread", "pastry", "cake"],
  cooking: ["home cook", "chef", "foodie"],
  "grilling_bbq": ["grill master", "barbecue", "smoker", "grilling"],
  "wine_cocktails": ["wine lover", "mixology", "cocktails", "sommelier"],
  fishing: ["angler", "fly fishing", "fisherman"],
  hiking: ["hiker", "trail", "backpacking"],
  camping: ["camper", "outdoors"],
  golf: ["golfer"],
  cycling: ["cyclist", "biking", "road bike"],
  yoga: ["yogi", "pilates"],
  "recovery_massage": ["sore muscles", "massage", "back pain"],
  "self_care": ["self care", "pamper", "spa day"],
  sleep: ["better sleep", "insomnia"],
  gardening: ["green thumb", "gardener", "plant lover"],
  "indoor_plants": ["houseplants", "succulents"],
  flowers: ["bouquet", "florist"],
  dogs: ["puppy", "dog lover", "pup", "dog mom", "dog dad"],
  cats: ["kitten", "cat lover", "cat mom"],
  "vinyl_records": ["turntable", "records", "record player", "vinyl"],
  guitar: ["guitarist"],
  photography: ["photographer", "camera"],
  gaming: ["gamer", "video games"],
  "board_games": ["board game", "tabletop"],
  reading: [], // placeholder (root "books & reading" handled below)
};

type TagRow = { slug: string; dimension: string; label: string; path: string };

function buildTags(): TagRow[] {
  const rows: TagRow[] = [];
  const seen = new Set<string>();
  const push = (r: TagRow) => {
    if (seen.has(r.slug)) throw new Error(`duplicate slug: ${r.slug} (${r.dimension}/${r.label})`);
    seen.add(r.slug);
    rows.push(r);
  };
  // interests (clean, unprefixed slugs so ltree paths read well)
  for (const [root, children] of Object.entries(INTERESTS)) {
    const rs = slugify(root);
    push({ slug: rs, dimension: "interest", label: root, path: rs });
    for (const c of children) {
      const cs = slugify(c);
      push({ slug: cs, dimension: "interest", label: c, path: `${rs}.${cs}` });
    }
  }
  // flat dimensions (slug prefixed with dimension to guarantee global uniqueness,
  // e.g. style "experience" vs gift_type "experience")
  for (const [dim, labels] of Object.entries(FLAT)) {
    for (const l of labels) {
      const s = `${dim}_${slugify(l)}`;
      push({ slug: s, dimension: dim, label: l, path: s });
    }
  }
  return rows;
}

async function main() {
  console.log(`Seeding tag taxonomy → ${PROD ? "PROD" : "DEV"} (${url})`);
  const tags = buildTags();

  const { error: tErr } = await db.from("tags").upsert(tags, { onConflict: "slug" });
  if (tErr) { console.error("tags upsert failed:", tErr.message); process.exit(1); }

  // Resolve slug → id for synonym rows.
  const { data: all, error: selErr } = await db.from("tags").select("id, slug");
  if (selErr) { console.error("tags select failed:", selErr.message); process.exit(1); }
  const idBySlug = new Map((all || []).map((t: any) => [t.slug, t.id]));

  const synRows: { phrase: string; tag_id: string }[] = [];
  for (const [slug, phrases] of Object.entries(SYNONYMS)) {
    const id = idBySlug.get(slug);
    if (!id) { if (phrases.length) console.warn(`  (skip synonyms for unknown slug '${slug}')`); continue; }
    for (const p of phrases) synRows.push({ phrase: p.toLowerCase(), tag_id: id });
  }
  if (synRows.length) {
    const { error: sErr } = await db.from("tag_synonyms").upsert(synRows, { onConflict: "phrase,tag_id" });
    if (sErr) { console.error("synonyms upsert failed:", sErr.message); process.exit(1); }
  }

  // Report
  const byDim: Record<string, number> = {};
  for (const t of tags) byDim[t.dimension] = (byDim[t.dimension] || 0) + 1;
  console.log(`\nUpserted ${tags.length} tags:`);
  Object.entries(byDim).forEach(([d, c]) => console.log(`  ${c.toString().padStart(3)}  ${d}`));
  console.log(`Upserted ${synRows.length} synonyms.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
