// Quiz simulator — runs the REAL recommender (src/lib/recommend.ts) against the
// live catalogue (gifts + approved affiliate products), so you can preview quiz
// quality from the terminal without the browser.
//
//   npx tsx scripts/quiz-sim.ts
//
// Edit the SCENARIOS array below (or pass a scenario name as the first arg).
// Uses .env.local (prod Supabase) by default; pass --dev to target the dev DB.
//
// NOTE: mirrors src/lib/affiliate/candidates.ts (inlined here because that file
// uses "@/" imports tsx can't resolve). Keep the two in sync if the real query
// changes.

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getRecommendations, styleOf, type Gift, type QuizAnswers } from "../src/lib/recommend";
import { isBlockedTitle } from "../src/lib/affiliate/blocklist";
import { isMerchantExcluded } from "../src/lib/affiliate/merchant-exclusions";
import { ALL_DEPTH_IDS, EMPTY_STATE, MIN_DEPTH_PRODUCTS, type V2State } from "../src/lib/quiz-v2/graph";
import { toQuizAnswers } from "../src/lib/quiz-v2/map";

const useDev = process.argv.includes("--dev");
config({ path: useDev ? ".env.dev.local" : ".env.local", override: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const BUDGET_BANDS: Record<string, [number, number]> = {
  "under-25": [0, 25], "25-50": [25, 50], "50-100": [50, 100], "100-200": [100, 200],
};

type Scenario = { name: string; answers: QuizAnswers };
const SCENARIOS: Scenario[] = [
  { name: "baby-shower", answers: { recipient: "child", occasion: "baby shower", interests: ["fashion & accessories", "apparel"], budget: "50-100", ageGroup: "under12", gender: "male", freeText: "New baby use new clothes all the time" } },
  { name: "coffee", answers: { recipient: "her", occasion: "birthday", interests: ["home & kitchen", "coffee"], budget: "50-100", ageGroup: "", gender: "female", freeText: "obsessed with coffee" } },
  { name: "no-alcohol", answers: { recipient: "her", occasion: "birthday", interests: ["home & kitchen"], budget: "50-100", ageGroup: "", gender: "female", freeText: "", avoidFlags: ["no alcohol"] } },
  { name: "sympathy", answers: { recipient: "friend", occasion: "sympathy", interests: [], budget: "50-100", ageGroup: "", gender: "unknown", freeText: "lost her mother" } },
  // Step 6 branching quiz (v2): answers go through the real v2 → recommender mapper.
  { name: "v2-coffee-mom", answers: toQuizAnswers(v2({ relationship: "mom", lifeStage: "50s-60s", occasion: "mother's day", saturday: ["kitchen"], depth: ["coffee"], level: "expert", feel: "treat", budget: "50-100" })) },
  { name: "v2-sympathy-friend", answers: toQuizAnswers(v2({ relationship: "friend", gender: "her", occasion: "sympathy", feel: "sentimental", budget: "50-100", freeText: "lost her mother" })) },
  { name: "v2-baby-shower", answers: toQuizAnswers(v2({ relationship: "friend", gender: "her", lifeStage: "30s-40s", occasion: "new baby", saturday: ["relaxing"], feel: "practical", budget: "50-100" })) },
  { name: "v2-teen-gamer", answers: toQuizAnswers(v2({ relationship: "child", lifeStage: "teen", gender: "him", occasion: "birthday", saturday: ["gadgets"], depth: ["gaming"], feel: "fun", budget: "25-50" })) },
  { name: "v2-coworker", answers: toQuizAnswers(v2({ relationship: "coworker", occasion: "thank you", saturday: ["reading", "hosting"], feel: "surprise", budget: "under-25" })) },
  { name: "v2-fisherman-dad", answers: toQuizAnswers(v2({ relationship: "dad", lifeStage: "70+", occasion: "father's day", saturday: ["outdoors"], depth: ["fishing"], level: "beginner", feel: "practical", budget: "100-200" })) },
  // Owner's live phone test (2026-10-12) — exact answers from quiz_sessions.
  { name: "owner-fit-partner", answers: toQuizAnswers(v2({ relationship: "partner", gender: "her", lifeStage: "30s-40s", recipientName: "Julia", occasion: "just because", saturday: ["active"], level: "enthusiast", feel: "experience", budget: "100-200", freeText: "She loves to be healthy and fit" })) },
  { name: "owner-sympathy", answers: toQuizAnswers(v2({ relationship: "friend", lifeStage: "50s-60s", recipientName: "Don", occasion: "sympathy", feel: "sentimental", budget: "50-100", freeText: "Sympathy for him. His mother died " })) },
  { name: "owner-toddler-pets", answers: toQuizAnswers(v2({ relationship: "child", gender: "her", lifeStage: "toddler", recipientName: "Mona", occasion: "just because", saturday: ["pets"], feel: "practical", budget: "50-100", avoids: ["no alcohol"], freeText: "Lovely kids who loves animals " })) },
];

function v2(o: Partial<V2State>): V2State {
  return { ...EMPTY_STATE, ...o };
}

async function loadProductCandidates(answers: QuizAnswers): Promise<Gift[]> {
  const cols = "id, title, description, image_url, price, tags, occasions, recipients, gender, affiliate_link, network, merchant_name, style, gift_type, avoid_flags, primary_interest";
  const wantGender = (answers.gender || "").toLowerCase();
  const genders = wantGender === "male" || wantGender === "female" ? ["unisex", wantGender] : null;
  const band = BUDGET_BANDS[answers.budget];
  const base = () => {
    let q = db.from("products").select(cols).eq("active", true).eq("in_stock", true).eq("status", "approved").not("image_url", "is", null);
    if (genders) q = q.in("gender", genders);
    if (band) q = q.lte("price", band[1]);
    return q;
  };
  const interests = (answers.interests || []).filter(Boolean);
  const queries: any[] = [];
  if (interests.length) queries.push(base().overlaps("tags", interests).limit(600));
  if (answers.recipient) queries.push(base().contains("recipients", [answers.recipient]).limit(400));
  if (answers.occasion) queries.push(base().contains("occasions", [answers.occasion]).limit(400));
  if (queries.length === 0) queries.push(base().limit(400));
  const results = await Promise.all(queries);
  const map = new Map<string, any>();
  for (const r of results) for (const p of (r.data || [])) if (!map.has(p.id)) map.set(p.id, p);
  return Array.from(map.values())
    .filter((p) => !isBlockedTitle(p.title, p.merchant_name))
    .filter((p) => !isMerchantExcluded(p.merchant_name, answers))
    .map((p): Gift => {
    const price = Number(p.price) || 0;
    const g: Gift = {
      id: p.id, name: p.title, description: p.description || "", image_url: p.image_url || "",
      price_min: price, price_max: price, tags: p.tags || [], occasions: p.occasions || [],
      recipients: p.recipients || [], gender: p.gender || "unisex", slug: null,
      destination_url: p.affiliate_link, affiliate_url: p.affiliate_link, affiliate_network: p.network || "awin",
      active: true, style: p.style || [], gift_type: p.gift_type || [], avoid_flags: p.avoid_flags || [], primary_interest: p.primary_interest || null,
    };
    (g as any).__source = "product";
    return g;
  });
}

// `--depth-counts`: approved, in-stock products per S4 depth option — the
// branching quiz only offers options with MIN_DEPTH_PRODUCTS or more.
async function depthCounts() {
  for (const id of ALL_DEPTH_IDS) {
    const { count } = await db.from("products").select("id", { count: "exact", head: true })
      .eq("active", true).eq("in_stock", true).eq("status", "approved").contains("tags", [id]);
    const { count: giftCount } = await db.from("gifts").select("id", { count: "exact", head: true }).eq("active", true).contains("tags", [id]);
    const total = (count || 0) + (giftCount || 0);
    console.log(`  ${total >= MIN_DEPTH_PRODUCTS ? "show" : "HIDE"}  ${id.padEnd(18)} ${total} (${count || 0} products + ${giftCount || 0} gifts)`);
  }
  process.exit(0);
}

async function run() {
  if (process.argv.includes("--depth-counts")) return depthCounts();
  const only = process.argv.find((a) => !a.startsWith("-") && SCENARIOS.some((s) => s.name === a));
  const { data: gifts } = await db.from("gifts").select("*").eq("active", true);
  for (const sc of SCENARIOS.filter((s) => !only || s.name === only)) {
    const products = await loadProductCandidates(sc.answers);
    const catalogue = [...(gifts || []), ...products];
    const recs = getRecommendations(sc.answers, catalogue as Gift[], { seed: 1, limit: 3 });
    console.log(`\n=== ${sc.name} === (${products.length} product candidates + ${gifts?.length || 0} gifts)`);
    console.log(`    age=${sc.answers.ageGroup || "-"} occasion=${sc.answers.occasion} interests=${JSON.stringify(sc.answers.interests)} budget=${sc.answers.budget}${sc.answers.avoidFlags ? " avoid=" + JSON.stringify(sc.answers.avoidFlags) : ""}`);
    recs.forEach((r, i) => {
      const src = (r.gift as any).__source === "product" ? "prod" : "gift";
      console.log(`  ${i + 1}. [${r.matchScorePercent}%] {${styleOf(r.gift)}} ${r.gift.name.slice(0, 44)} «occ:${(r.gift.occasions || []).join(",") || "-"}» «tag:${(r.gift.tags || []).join(",") || "-"}» (${src})`);
    });
  }
  process.exit(0);
}
run();
