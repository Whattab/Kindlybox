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
import { getRecommendations, type Gift, type QuizAnswers } from "../src/lib/recommend";
import { isBlockedTitle } from "../src/lib/affiliate/blocklist";

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
];

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
  return Array.from(map.values()).filter((p) => !isBlockedTitle(p.title, p.merchant_name)).map((p): Gift => {
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

async function run() {
  const only = process.argv.find((a) => !a.startsWith("-") && SCENARIOS.some((s) => s.name === a));
  const { data: gifts } = await db.from("gifts").select("*").eq("active", true);
  for (const sc of SCENARIOS.filter((s) => !only || s.name === only)) {
    const products = await loadProductCandidates(sc.answers);
    const catalogue = [...(gifts || []), ...products];
    const recs = getRecommendations(sc.answers, catalogue as Gift[], { seed: 1, limit: 3 });
    console.log(`\n=== ${sc.name} === (${products.length} product candidates + ${gifts?.length || 0} gifts)`);
    console.log(`    occasion=${sc.answers.occasion} interests=${JSON.stringify(sc.answers.interests)} budget=${sc.answers.budget}${sc.answers.avoidFlags ? " avoid=" + JSON.stringify(sc.answers.avoidFlags) : ""}`);
    recs.forEach((r, i) => {
      const src = (r.gift as any).__source === "product" ? "prod" : "gift";
      console.log(`  ${i + 1}. [${r.matchScorePercent}%] ${r.gift.name.slice(0, 48)} «occ:${(r.gift.occasions || []).join(",") || "-"}» «tag:${(r.gift.tags || []).join(",") || "-"}» (${src})`);
    });
  }
  process.exit(0);
}
run();
