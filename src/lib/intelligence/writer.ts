// Phase 2 — turns an APPROVED content opportunity into a published article.
//
// Two stages on purpose, so there is a human review point before any prose is
// written:
//
//   1. generateOutline()   angle + sections + products + keywords + internal
//                          links. Cheap to regenerate, quick to edit.
//   2. writeFromOutline()  the full article, written to follow that outline.
//
// The article is always built around REAL catalogue products (never invented
// ones), and every product links through /go/<slug> so affiliate destinations
// stay swappable in the DB.
//
// Gemini writes both stages. If it's unavailable or errors, templated output
// keeps the pipeline moving — marked `generated_by: 'template'` so you can see
// it needs a human pass.

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

export interface OutlineSection {
  heading: string;
  purpose: string;
}

export interface InternalLink {
  href: string;
  label: string;
}

export interface Outline {
  angle: string;
  sections: OutlineSection[];
  internal_links: InternalLink[];
}

export interface OutlinePlan {
  title: string;
  slug: string;
  meta_description: string;
  excerpt: string;
  content_type: string;
  primary_keyword: string | null;
  secondary_keywords: string[];
  outline: Outline;
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

const GIFT_COLS = "id, name, description, slug, image_url, price_min, price_max, tags, occasions, recipients";

export function toProductBlock(g: GiftRow): ProductBlock {
  return {
    gift_id: g.id,
    name: g.name,
    slug: g.slug,
    image_url: g.image_url,
    price_min: g.price_min,
    price_max: g.price_max,
    heading: g.name,
    blurb: g.description || `A thoughtful pick from the KindlyBox catalogue${priceLabel(g) ? ` (${priceLabel(g)})` : ""}.`,
  };
}

// Catalogue search behind the editor's product picker.
export async function searchCatalogue(query: string, limit = 12): Promise<ProductBlock[]> {
  const admin = createServiceClient();
  const q = query.trim();
  let req = admin.from("gifts").select(GIFT_COLS).eq("active", true).limit(limit);
  if (q) req = req.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  const { data } = await req;
  return ((data ?? []) as GiftRow[]).map(toProductBlock);
}

// Products for the article: the opportunity's own picks first, then a keyword
// top-up so a thin opportunity still yields a useful guide.
async function collectProducts(opp: any): Promise<GiftRow[]> {
  const admin = createServiceClient();

  const ids = ((opp.recommended_products ?? []) as { gift_id: string }[]).map((p) => p.gift_id).filter(Boolean);
  let picked: GiftRow[] = [];
  if (ids.length > 0) {
    const { data } = await admin.from("gifts").select(GIFT_COLS).in("id", ids).eq("active", true);
    // Preserve the opportunity's ordering (it ranked affiliate-linked products first).
    const byId = new Map((data ?? []).map((g: any) => [g.id as string, g as GiftRow]));
    picked = ids.map((id) => byId.get(id)).filter(Boolean) as GiftRow[];
  }

  if (picked.length < MAX_PRODUCTS) {
    // Top up by keyword over the live catalogue.
    const stop = new Set(["for", "best", "gift", "gifts", "ideas", "idea", "the", "and", "your", "top"]);
    const terms = String(opp.primary_keyword || opp.topic || "")
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2 && !stop.has(t));
    const { data: all } = await admin.from("gifts").select(GIFT_COLS).eq("active", true);
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
  }

  // A gift with no slug can't be linked through /go/, so its card would have no
  // button. Keep those (the copy is still useful) but push them to the bottom
  // so the article leads with gifts the reader can actually buy.
  const linkable = picked.filter((g) => g.slug);
  const unlinkable = picked.filter((g) => !g.slug);
  return [...linkable, ...unlinkable].slice(0, MAX_PRODUCTS);
}

// Published guides the new article can link to. Internal links are what make a
// growing blog compound, so the writer is always given the current list.
async function publishedGuides(excludeId?: string): Promise<{ title: string; slug: string; primary_keyword: string | null }[]> {
  const admin = createServiceClient();
  let req = admin
    .from("articles")
    .select("id, title, slug, primary_keyword")
    .eq("status", "PUBLISHED")
    .order("published_at", { ascending: false })
    .limit(30);
  if (excludeId) req = req.neq("id", excludeId);
  const { data } = await req;
  return (data ?? []).map((a) => ({ title: a.title, slug: a.slug, primary_keyword: a.primary_keyword }));
}

function callModel(maxOutputTokens: number) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      maxOutputTokens,
      temperature: 0.7,
      responseMimeType: "application/json",
      // @ts-expect-error thinkingConfig is valid at runtime; keeps the budget from eating the output.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
}

// ---- stage 1: the outline -------------------------------------------------

export async function generateOutline(opportunityId: string): Promise<OutlinePlan> {
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
  const guides = await publishedGuides();
  const blocks = gifts.map(toProductBlock);
  const title = opp.suggested_title || opp.topic;

  // Templated plan — also the fallback if the model is unavailable.
  let plan: Omit<OutlinePlan, "slug"> = {
    title,
    meta_description: String(opp.why_now || title).slice(0, 155),
    excerpt: `${gifts.length} hand-picked gift ideas from the KindlyBox catalogue.`,
    content_type: opp.content_type || "gift_guide",
    primary_keyword: opp.primary_keyword ?? null,
    secondary_keywords: opp.secondary_keywords ?? [],
    outline: {
      angle: `A practical, evidence-led guide to ${opp.topic.toLowerCase()}, built around gifts already in the KindlyBox catalogue.`,
      sections: [
        { heading: "Introduction", purpose: "Who this guide is for and why it matters right now." },
        { heading: "The picks", purpose: "The product cards — each gift, who it suits, why it lands." },
        { heading: "How to choose", purpose: "Practical buying advice specific to this topic." },
        { heading: "Frequently asked questions", purpose: "Answer the questions shoppers actually ask." },
        { heading: "Closing", purpose: "Wrap up and point the reader to the gift quiz." },
      ],
      internal_links: guides.slice(0, 3).map((g) => ({ href: `/blog/${g.slug}`, label: g.title })),
    },
    product_blocks: blocks,
    generated_by: "template",
  };

  const model = callModel(1600);
  if (model) {
    try {
      const productList = gifts
        .map((g, i) => `${i + 1}. id: ${g.id} | name: "${g.name}" | price: ${priceLabel(g) || "n/a"} | notes: ${(g.description || "").slice(0, 140)}`)
        .join("\n");
      const guideList = guides.length
        ? guides.map((g) => `- /blog/${g.slug} — "${g.title}"`).join("\n")
        : "(none published yet)";

      const prompt = [
        "You are a senior SEO content strategist for KindlyBox, a gift-recommendation site.",
        "Plan an article — do NOT write it yet. The plan will be reviewed by a human before drafting.",
        "",
        "BRIEF",
        `Topic: ${opp.topic}`,
        `Working title: ${title}`,
        `Content type: ${opp.content_type || "gift_guide"}`,
        `Primary keyword: ${opp.primary_keyword || "n/a"}`,
        `Existing secondary keywords: ${(opp.secondary_keywords ?? []).join(", ") || "none yet"}`,
        `Why this is timely: ${opp.why_now || "n/a"}`,
        "",
        "CATALOGUE PRODUCTS AVAILABLE (real; never invent products or prices):",
        productList,
        "",
        "ALREADY-PUBLISHED GUIDES you may link to internally:",
        guideList,
        "",
        "Return ONLY JSON:",
        "{",
        '  "title": "final H1, max 65 chars, includes the primary keyword naturally",',
        '  "angle": "1-2 sentences: the specific angle that makes this guide worth reading",',
        '  "meta_description": "max 155 chars",',
        '  "excerpt": "one sentence for the blog index card",',
        '  "secondary_keywords": ["4-6 realistic long-tail keywords to work in naturally"],',
        '  "sections": [{"heading": "section heading", "purpose": "one line on what it covers"}],',
        '  "internal_links": [{"href": "/blog/<slug from the list above>", "label": "anchor text"}]',
        "}",
        "",
        'Rules: 4-6 sections. Exactly one section must be the product picks, and its heading must make clear the gifts go there. Only use internal_links hrefs from the list above — if the list is empty, return []. No invented statistics.',
      ].join("\n");

      const parsed = JSON.parse((await model.generateContent(prompt)).response.text().trim());
      const sections = (parsed.sections ?? [])
        .filter((s: any) => s?.heading)
        .map((s: any) => ({ heading: String(s.heading).slice(0, 120), purpose: String(s.purpose || "").slice(0, 240) }));
      const validHrefs = new Set(guides.map((g) => `/blog/${g.slug}`));
      const links = (parsed.internal_links ?? [])
        .filter((l: any) => l?.href && validHrefs.has(String(l.href)))
        .map((l: any) => ({ href: String(l.href), label: String(l.label || l.href) }));

      if (parsed.title && sections.length >= 3) {
        plan = {
          title: String(parsed.title).slice(0, 120),
          meta_description: String(parsed.meta_description || plan.meta_description).slice(0, 160),
          excerpt: String(parsed.excerpt || plan.excerpt).slice(0, 240),
          content_type: opp.content_type || "gift_guide",
          primary_keyword: opp.primary_keyword ?? null,
          secondary_keywords: Array.isArray(parsed.secondary_keywords)
            ? parsed.secondary_keywords.map(String).slice(0, 8)
            : plan.secondary_keywords,
          outline: {
            angle: String(parsed.angle || plan.outline.angle).slice(0, 400),
            sections,
            internal_links: links,
          },
          product_blocks: blocks,
          generated_by: GEMINI_MODEL,
        };
      }
    } catch (err) {
      console.error("[writer] outline generation failed, using template:", (err as any)?.message || err);
    }
  }

  // Phase 1 created `recommended_links` for exactly this — keep the opportunity
  // in step with the internal links the plan chose.
  await admin
    .from("content_opportunities")
    .update({ recommended_links: plan.outline.internal_links, updated_at: new Date().toISOString() })
    .eq("id", opportunityId);

  return { ...plan, slug: await uniqueSlug(plan.title) };
}

// ---- stage 2: the article -------------------------------------------------

export interface WrittenArticle {
  body: string;
  product_blocks: ProductBlock[];
  generated_by: string;
}

function templateBody(outline: Outline, products: ProductBlock[]): string {
  const parts: string[] = [];
  const productHeadingIdx = Math.min(1, Math.max(0, outline.sections.length - 1));

  outline.sections.forEach((s, i) => {
    const isIntro = i === 0;
    const isProducts = i === productHeadingIdx;
    if (!isIntro) parts.push(`## ${s.heading}`, "");
    if (isProducts) {
      parts.push(PRODUCTS_TOKEN, "");
    } else {
      parts.push(s.purpose || `More on ${s.heading.toLowerCase()}.`, "");
    }
  });

  if (!parts.join("\n").includes(PRODUCTS_TOKEN)) parts.push(PRODUCTS_TOKEN, "");
  if (outline.internal_links.length > 0) {
    parts.push("You might also like " + outline.internal_links.map((l) => `[${l.label}](${l.href})`).join(", ") + ".", "");
  }
  parts.push("Not sure yet? Take the [KindlyBox gift quiz](/quiz) and we'll match them to specific gifts.");
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function writeFromOutline(articleId: string): Promise<WrittenArticle> {
  const admin = createServiceClient();
  const { data: article } = await admin.from("articles").select("*").eq("id", articleId).maybeSingle();
  if (!article) throw new Error("Article not found");

  const outline = (article.outline ?? {}) as Outline;
  const sections = outline.sections ?? [];
  if (sections.length === 0) throw new Error("This article has no outline sections yet — add at least one before writing.");

  const products = (article.product_blocks ?? []) as ProductBlock[];
  if (products.length === 0) throw new Error("Add at least one product before writing the article.");

  let written: WrittenArticle = {
    body: templateBody({ angle: outline.angle || "", sections, internal_links: outline.internal_links ?? [] }, products),
    product_blocks: products,
    generated_by: "template",
  };

  const model = callModel(4000);
  if (model) {
    try {
      const productList = products
        .map((p, i) => `${i + 1}. id: ${p.gift_id} | name: "${p.name}" | price: ${priceLabel(p) || "n/a"} | current note: ${(p.blurb || "").slice(0, 140)}`)
        .join("\n");
      const sectionList = sections.map((s, i) => `${i + 1}. ${s.heading} — ${s.purpose}`).join("\n");
      const linkList = (outline.internal_links ?? []).length
        ? (outline.internal_links ?? []).map((l) => `- [${l.label}](${l.href})`).join("\n")
        : "(none)";

      const prompt = [
        "You are a senior gift writer for KindlyBox. Write the article to the approved plan below — warm, specific, no filler, no hype, no invented statistics.",
        "",
        "APPROVED PLAN",
        `Title: ${article.title}`,
        `Angle: ${outline.angle || "n/a"}`,
        `Primary keyword (use naturally, never stuff): ${article.primary_keyword || "n/a"}`,
        `Secondary keywords to work in naturally: ${(article.secondary_keywords ?? []).join(", ") || "none"}`,
        "",
        "SECTIONS (follow this structure and order):",
        sectionList,
        "",
        "PRODUCTS TO FEATURE (real catalogue — never invent products, prices, brands or reviews):",
        productList,
        "",
        "INTERNAL LINKS to work in naturally, at most once each:",
        linkList,
        "",
        "Return ONLY JSON:",
        "{",
        '  "body_markdown": "the full article in markdown. Use ## for section headings. Do NOT write the product write-ups inline — instead put the single line {{products}} on its own line where the product cards belong. Include the internal links as markdown links. End by inviting the reader to take the KindlyBox gift quiz, linking to /quiz.",',
        '  "products": [{"gift_id": "exact id from the list", "heading": "short punchy heading for this gift", "blurb": "2-3 sentences: who it suits and why it lands."}]',
        "}",
        "",
        'Rules: body_markdown MUST contain {{products}} exactly once. Do not repeat the H1 title as a heading. Include EVERY product in "products", in the given order, with the exact gift_id.',
      ].join("\n");

      const parsed = JSON.parse((await model.generateContent(prompt)).response.text().trim());
      const body = String(parsed.body_markdown || "").trim();

      const byId = new Map(products.map((p) => [p.gift_id, p]));
      const rewritten: ProductBlock[] = [];
      for (const p of (parsed.products ?? []) as { gift_id: string; heading: string; blurb: string }[]) {
        const existing = byId.get(p.gift_id);
        if (!existing || !p.blurb) continue;
        rewritten.push({ ...existing, heading: String(p.heading || existing.name).slice(0, 90), blurb: String(p.blurb) });
        byId.delete(p.gift_id);
      }
      // Anything the model skipped keeps its existing blurb rather than vanishing.
      byId.forEach((p) => rewritten.push(p));

      if (body.includes(PRODUCTS_TOKEN) && rewritten.length > 0) {
        written = { body, product_blocks: rewritten, generated_by: GEMINI_MODEL };
      }
    } catch (err) {
      console.error("[writer] article generation failed, using template:", (err as any)?.message || err);
    }
  }

  return written;
}

// ---- FAQ extraction (for FAQPage structured data) -------------------------

// Pulls "### Question" + the paragraph under it out of a rendered body, so the
// schema always matches what a reader actually sees — including after edits.
export function extractFaq(body: string): { q: string; a: string }[] {
  const lines = String(body || "").replace(/\r\n/g, "\n").split("\n");
  const out: { q: string; a: string }[] = [];
  let inFaq = false;
  let current: { q: string; a: string[] } | null = null;

  const flush = () => {
    if (current && current.a.join(" ").trim()) out.push({ q: current.q, a: current.a.join(" ").trim() });
    current = null;
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      flush();
      inFaq = /faq|frequently asked/i.test(h2[1]);
      continue;
    }
    if (!inFaq) continue;
    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) {
      flush();
      current = { q: h3[1].trim(), a: [] };
      continue;
    }
    if (current && line.trim()) current.a.push(line.trim());
  }
  flush();
  return out.slice(0, 10);
}
