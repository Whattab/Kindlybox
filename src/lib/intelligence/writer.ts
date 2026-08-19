// Phase 2 — turns an APPROVED content opportunity into a draft article.
//
// The article is built around REAL catalog products (never invented ones): the
// opportunity's recommended products first, topped up by a keyword match over
// the live catalog. Every product links through /go/<slug>, so affiliate
// destinations stay swappable in the DB.
//
// Gemini writes the prose. If it's unavailable or errors, we fall back to a
// templated draft so approving an opportunity never dead-ends — the draft is
// marked `generated_by: 'template'` so you can see it needs a human pass.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServiceClient } from "@/utils/supabase/admin";

const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_PRODUCTS = 8;

// The token the article page swaps for the product cards.
export const PRODUCTS_TOKEN = "{{products}}";

export interface ProductBlock {
  gift_id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  price_min: number | null;
  price_max: number | null;
  heading: string;
  blurb: string;
}

export interface ArticleDraft {
  title: string;
  slug: string;
  meta_description: string;
  excerpt: string;
  body: string;
  hero_image_url: string | null;
  content_type: string;
  primary_keyword: string | null;
  secondary_keywords: string[];
  product_blocks: ProductBlock[];
  generated_by: string;
}

interface GiftRow {
  id: string; name: string; description: string | null; slug: string | null;
  image_url: string | null; price_min: number | null; price_max: number | null;
  tags: string[] | null; occasions: string[] | null; recipients: string[] | null;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

// Append -2, -3 … until the slug is free. `ignoreId` lets an article keep its
// own slug when it is being re-saved.
export async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const admin = createServiceClient();
  const root = slugify(base) || "gift-guide";
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const { data } = await admin.from("articles").select("id").eq("slug", candidate).maybeSingle();
    if (!data || data.id === ignoreId) return candidate;
  }
  return `${root}-${Date.now()}`;
}

const priceLabel = (g: { price_min: number | null; price_max: number | null }) => {
  if (g.price_min == null && g.price_max == null) return "";
  if (g.price_min != null && g.price_max != null && g.price_min !== g.price_max) return `$${g.price_min}-$${g.price_max}`;
  return `$${g.price_min ?? g.price_max}`;
};

// Products for the article: the opportunity's own picks first, then a keyword
// top-up so a thin opportunity still yields a useful guide.
async function collectProducts(opp: any): Promise<GiftRow[]> {
  const admin = createServiceClient();
  const cols = "id, name, description, slug, image_url, price_min, price_max, tags, occasions, recipients";

  const ids = ((opp.recommended_products ?? []) as { gift_id: string }[]).map((p) => p.gift_id).filter(Boolean);
  let picked: GiftRow[] = [];
  if (ids.length > 0) {
    const { data } = await admin.from("gifts").select(cols).in("id", ids).eq("active", true);
    // Preserve the opportunity's ordering (it ranked affiliate-linked products first).
    const byId = new Map((data ?? []).map((g: any) => [g.id as string, g as GiftRow]));
    picked = ids.map((id) => byId.get(id)).filter(Boolean) as GiftRow[];
  }
  if (picked.length >= MAX_PRODUCTS) return picked.slice(0, MAX_PRODUCTS);

  // Top up by keyword over the live catalog.
  const stop = new Set(["for", "best", "gift", "gifts", "ideas", "idea", "the", "and", "your", "top"]);
  const terms = String(opp.primary_keyword || opp.topic || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2 && !stop.has(t));
  const { data: all } = await admin.from("gifts").select(cols).eq("active", true);
  const have = new Set(picked.map((g) => g.id));
  for (const g of (all ?? []) as GiftRow[]) {
    if (picked.length >= MAX_PRODUCTS) break;
    if (have.has(g.id)) continue;
    const hay = [g.name, g.description, (g.tags || []).join(" "), (g.occasions || []).join(" "), (g.recipients || []).join(" ")]
      .join(" ")
      .toLowerCase();
    if (terms.length === 0 || terms.some((t) => hay.includes(t))) {
      picked.push(g);
      have.add(g.id);
    }
  }

  // A gift with no slug can't be linked through /go/, so its card would have no
  // button. Keep those (the copy is still useful) but push them to the bottom
  // so the article leads with gifts the reader can actually buy.
  const linkable = picked.filter((g) => g.slug);
  const unlinkable = picked.filter((g) => !g.slug);
  return [...linkable, ...unlinkable].slice(0, MAX_PRODUCTS);
}

// ---- templated fallback ---------------------------------------------------

function templateDraft(opp: any, gifts: GiftRow[]): Omit<ArticleDraft, "slug"> {
  const title = opp.suggested_title || opp.topic;
  const blocks: ProductBlock[] = gifts.map((g) => ({
    gift_id: g.id,
    name: g.name,
    slug: g.slug,
    image_url: g.image_url,
    price_min: g.price_min,
    price_max: g.price_max,
    heading: g.name,
    blurb: g.description || `A thoughtful pick from the KindlyBox catalogue${priceLabel(g) ? ` (${priceLabel(g)})` : ""}.`,
  }));

  const why = String(opp.why_now || "").replace(/\.$/, "");
  const body = [
    `Finding the right gift shouldn't take an afternoon of scrolling. We pulled the picks below from the KindlyBox catalogue${why ? `, because ${why.charAt(0).toLowerCase()}${why.slice(1)}` : ""}.`,
    "",
    PRODUCTS_TOKEN,
    "",
    "## How we chose these",
    "",
    "Every gift here is one we would actually give: a clear reason to love it, a sensible price, and a recipient it genuinely suits — not a page of filler.",
    "",
    "## Still not sure?",
    "",
    "Take the KindlyBox gift quiz. Answer a few questions about who you are shopping for and we will match them to specific gifts, with a personal note explaining why each one fits.",
  ].join("\n");

  return {
    title,
    meta_description: String(opp.why_now || title).slice(0, 155),
    excerpt: `${gifts.length} hand-picked gift ideas from the KindlyBox catalogue.`,
    body,
    hero_image_url: gifts.find((g) => g.image_url)?.image_url ?? null,
    content_type: opp.content_type || "gift_guide",
    primary_keyword: opp.primary_keyword ?? null,
    secondary_keywords: opp.secondary_keywords ?? [],
    product_blocks: blocks,
    generated_by: "template",
  };
}

// ---- AI draft -------------------------------------------------------------

export async function generateArticleDraft(opportunityId: string): Promise<ArticleDraft> {
  const admin = createServiceClient();
  const { data: opp, error } = await admin
    .from("content_opportunities")
    .select("*")
    .eq("id", opportunityId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!opp) throw new Error("Opportunity not found");

  const gifts = await collectProducts(opp);
  if (gifts.length === 0) {
    throw new Error("No active catalogue products match this topic yet — add matching gifts first.");
  }

  let draft = templateDraft(opp, gifts);
  const key = process.env.GEMINI_API_KEY;

  if (key) {
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: {
          maxOutputTokens: 4000,
          temperature: 0.75,
          responseMimeType: "application/json",
          // @ts-expect-error thinkingConfig is valid at runtime; keeps the budget from eating the output.
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const productList = gifts
        .map((g, i) => `${i + 1}. id: ${g.id} | name: "${g.name}" | price: ${priceLabel(g) || "n/a"} | notes: ${(g.description || "").slice(0, 160)}`)
        .join("\n");

      const prompt = [
        "You are a senior gift writer for KindlyBox, a gift-recommendation site. Write a genuinely useful article — warm, specific, no filler, no hype, no invented statistics.",
        "",
        "ARTICLE BRIEF",
        `Topic: ${opp.topic}`,
        `Working title: ${opp.suggested_title || opp.topic}`,
        `Content type: ${opp.content_type || "gift_guide"}`,
        `Primary keyword (use naturally, never stuff): ${opp.primary_keyword || "n/a"}`,
        `Why this is timely: ${opp.why_now || "n/a"}`,
        "",
        "PRODUCTS YOU MUST FEATURE (this is the real catalogue — never invent products, prices, brands or reviews):",
        productList,
        "",
        "Return ONLY JSON in this exact shape:",
        "{",
        '  "title": "final H1, max 65 chars",',
        '  "meta_description": "max 155 chars, compelling, includes the keyword",',
        '  "excerpt": "one sentence for the blog index card",',
        '  "intro_markdown": "2 short paragraphs setting up who this is for and why now. No heading.",',
        '  "products": [{"gift_id": "exact id from the list", "heading": "short punchy heading for this gift", "blurb": "2-3 sentences: who it suits and why it lands. Concrete, no hype."}],',
        '  "buying_guide_markdown": "## How to choose\\nA short section with 3-5 bullet points of real buying advice for this topic.",',
        '  "faq": [{"q": "question shoppers actually ask", "a": "a direct 1-2 sentence answer"}],',
        '  "closing_markdown": "One short paragraph, then invite the reader to take the KindlyBox gift quiz. No heading."',
        "}",
        "",
        'Rules: include EVERY product from the list in "products", keeping the given order and using the exact gift_id. Use markdown headings (##) only inside the markdown fields. Never claim a price, discount, rating or delivery time that is not in the list above.',
      ].join("\n");

      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text().trim());

      const byId = new Map(gifts.map((g) => [g.id, g]));
      const written: ProductBlock[] = [];
      for (const p of (parsed.products ?? []) as { gift_id: string; heading: string; blurb: string }[]) {
        const g = byId.get(p.gift_id);
        if (!g || !p.blurb) continue;
        written.push({
          gift_id: g.id, name: g.name, slug: g.slug, image_url: g.image_url,
          price_min: g.price_min, price_max: g.price_max,
          heading: String(p.heading || g.name).slice(0, 90),
          blurb: String(p.blurb),
        });
        byId.delete(p.gift_id);
      }
      // Anything the model skipped keeps its templated blurb rather than vanishing.
      byId.forEach((g) => {
        const fallback = draft.product_blocks.find((b) => b.gift_id === g.id);
        if (fallback) written.push(fallback);
      });

      const faq = (parsed.faq ?? []) as { q: string; a: string }[];
      const faqMd = faq.length
        ? ["## Frequently asked questions", "", ...faq.flatMap((f) => [`### ${f.q}`, "", f.a, ""])].join("\n")
        : "";

      const body = [
        String(parsed.intro_markdown || "").trim(),
        "",
        PRODUCTS_TOKEN,
        "",
        String(parsed.buying_guide_markdown || "").trim(),
        "",
        faqMd.trim(),
        "",
        String(parsed.closing_markdown || "").trim(),
      ]
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      if (parsed.title && body.includes(PRODUCTS_TOKEN) && written.length > 0) {
        draft = {
          title: String(parsed.title).slice(0, 120),
          meta_description: String(parsed.meta_description || draft.meta_description).slice(0, 160),
          excerpt: String(parsed.excerpt || draft.excerpt).slice(0, 240),
          body,
          hero_image_url: draft.hero_image_url,
          content_type: opp.content_type || "gift_guide",
          primary_keyword: opp.primary_keyword ?? null,
          secondary_keywords: opp.secondary_keywords ?? [],
          product_blocks: written,
          generated_by: GEMINI_MODEL,
        };
      }
    } catch (err) {
      console.error("[writer] Gemini draft failed, using template:", (err as any)?.message || err);
    }
  }

  return { ...draft, slug: await uniqueSlug(draft.title) };
}
