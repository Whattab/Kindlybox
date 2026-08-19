"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/utils/admin";
import { createServiceClient } from "@/utils/supabase/admin";
import {
  generateOutline,
  writeFromOutline,
  uniqueSlug,
  slugify,
  searchCatalogue,
  type ProductBlock,
  type OutlineSection,
} from "@/lib/intelligence/writer";

const VALID_STATUS = new Set(["OUTLINE", "DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]);

// Keep the opportunity's status in step with its article, so the Gift
// Intelligence board reflects what actually happened to each idea.
const OPP_STATUS_FOR: Record<string, string> = {
  OUTLINE: "ANALYZING",
  DRAFT: "WRITING",
  REVIEW: "REVIEW",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "APPROVED", // article shelved, the idea itself is still approved
};

function refresh(slug?: string | null) {
  revalidatePath("/dashboard/articles");
  revalidatePath("/dashboard/intelligence");
  revalidatePath("/blog");
  if (slug) revalidatePath(`/blog/${slug}`);
}

async function syncOpportunity(opportunityId: string | null, status: string) {
  if (!opportunityId || !OPP_STATUS_FOR[status]) return;
  const admin = createServiceClient();
  await admin
    .from("content_opportunities")
    .update({ status: OPP_STATUS_FOR[status], updated_at: new Date().toISOString() })
    .eq("id", opportunityId);
}

// Stage 1 — plan the article. If one already exists we just hand back its id,
// so clicking twice never produces a duplicate.
export async function outlineArticleFromOpportunity(opportunityId: string): Promise<string> {
  await assertAdmin();
  const admin = createServiceClient();

  const { data: existing } = await admin
    .from("articles")
    .select("id")
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (existing) return existing.id;

  const plan = await generateOutline(opportunityId);

  const { data, error } = await admin
    .from("articles")
    .insert({
      ...plan,
      opportunity_id: opportunityId,
      body: "",
      status: "OUTLINE",
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await syncOpportunity(opportunityId, "OUTLINE");
  refresh();
  return data.id;
}

// Re-plan from the opportunity, keeping the article's slug so any link already
// shared stays valid.
export async function regenerateOutline(id: string) {
  await assertAdmin();
  const admin = createServiceClient();

  const { data: article } = await admin.from("articles").select("id, slug, opportunity_id, status").eq("id", id).maybeSingle();
  if (!article) throw new Error("Article not found");
  if (!article.opportunity_id) throw new Error("This article isn't linked to an opportunity, so it can't be re-planned.");
  if (article.status === "PUBLISHED") throw new Error("Unpublish before re-planning, so live copy is never overwritten.");

  const plan = await generateOutline(article.opportunity_id);
  const { slug, ...rest } = plan; // keep the existing slug

  const { error } = await admin
    .from("articles")
    .update({ ...rest, status: "OUTLINE", body: "", generated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await syncOpportunity(article.opportunity_id, "OUTLINE");
  refresh(article.slug);
}

// Save edits to the plan before anything is written.
export async function saveOutline(id: string, formData: FormData) {
  await assertAdmin();
  const admin = createServiceClient();

  const { data: current } = await admin.from("articles").select("slug, outline, product_blocks").eq("id", id).maybeSingle();
  if (!current) throw new Error("Article not found");

  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Title is required");

  // Sections come back as one per line: "Heading — what it covers".
  const sections: OutlineSection[] = String(formData.get("sections") || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [heading, ...rest] = line.split(/\s+[—–-]\s+/);
      return { heading: heading.trim().slice(0, 120), purpose: rest.join(" - ").trim().slice(0, 240) };
    })
    .filter((s) => s.heading);

  const outline = {
    ...((current.outline ?? {}) as Record<string, unknown>),
    angle: String(formData.get("angle") || "").slice(0, 400),
    sections,
  };

  const { error } = await admin
    .from("articles")
    .update({
      title,
      outline,
      secondary_keywords: parseKeywords(formData.get("secondary_keywords")),
      product_blocks: await resolveProducts(formData, (current.product_blocks ?? []) as ProductBlock[]),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  refresh(current.slug);
}

// Stage 2 — write the full article from the approved plan.
export async function writeFullArticle(id: string) {
  await assertAdmin();
  const admin = createServiceClient();

  const { data: article } = await admin.from("articles").select("id, slug, status, opportunity_id, outline").eq("id", id).maybeSingle();
  if (!article) throw new Error("Article not found");
  if (article.status === "PUBLISHED") throw new Error("Unpublish before rewriting, so live copy is never overwritten.");

  // Articles created before the outline stage existed have no plan. Rather than
  // failing, plan one first so Rewrite works on them too.
  const sections = ((article.outline ?? {}) as { sections?: unknown[] }).sections ?? [];
  if (sections.length === 0) {
    if (!article.opportunity_id) {
      throw new Error("This article has no plan and no linked opportunity, so there's nothing to write from.");
    }
    const plan = await generateOutline(article.opportunity_id);
    await admin
      .from("articles")
      .update({ outline: plan.outline, secondary_keywords: plan.secondary_keywords, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  const written = await writeFromOutline(id);

  const { error } = await admin
    .from("articles")
    .update({
      body: written.body,
      product_blocks: written.product_blocks,
      generated_by: written.generated_by,
      generated_at: new Date().toISOString(),
      status: "DRAFT",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await syncOpportunity(article.opportunity_id, "DRAFT");
  refresh(article.slug);
}

// Catalogue search for the editor's product picker.
export async function searchGifts(query: string): Promise<ProductBlock[]> {
  await assertAdmin();
  return searchCatalogue(query);
}

const parseKeywords = (raw: FormDataEntryValue | null): string[] =>
  String(raw || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 12);

// The picker submits the chosen gift ids in order. Products already on the
// article keep their edited heading and blurb; newly added ones start from the
// catalogue entry.
async function resolveProducts(formData: FormData, current: ProductBlock[]): Promise<ProductBlock[]> {
  const raw = formData.get("product_ids");
  if (raw == null) return current;

  const ids = String(raw).split(",").map((s) => s.trim()).filter(Boolean);
  const byId = new Map(current.map((b) => [b.gift_id, b]));

  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    const admin = createServiceClient();
    const { data } = await admin
      .from("gifts")
      .select("id, name, description, slug, image_url, price_min, price_max")
      .in("id", missing);
    for (const g of (data ?? []) as any[]) {
      byId.set(g.id, {
        gift_id: g.id, name: g.name, slug: g.slug, image_url: g.image_url,
        price_min: g.price_min, price_max: g.price_max,
        heading: g.name,
        blurb: g.description || "A thoughtful pick from the KindlyBox catalogue.",
      });
    }
  }

  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((b) => ({
      ...(b as ProductBlock),
      heading: String(formData.get(`heading_${(b as ProductBlock).gift_id}`) ?? (b as ProductBlock).heading).slice(0, 90),
      blurb: String(formData.get(`blurb_${(b as ProductBlock).gift_id}`) ?? (b as ProductBlock).blurb),
    }));
}

export async function saveArticle(id: string, formData: FormData) {
  await assertAdmin();
  const admin = createServiceClient();

  const { data: current } = await admin.from("articles").select("slug, product_blocks").eq("id", id).maybeSingle();
  if (!current) throw new Error("Article not found");

  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Title is required");

  // Only re-derive the slug when it actually changed, so published URLs are stable.
  const wanted = slugify(String(formData.get("slug") || "") || title);
  const slug = wanted === current.slug ? current.slug : await uniqueSlug(wanted, id);

  const { error } = await admin
    .from("articles")
    .update({
      title,
      slug,
      meta_description: String(formData.get("meta_description") || "").slice(0, 300),
      excerpt: String(formData.get("excerpt") || "").slice(0, 400),
      secondary_keywords: parseKeywords(formData.get("secondary_keywords")),
      hero_image_url: String(formData.get("hero_image_url") || "") || null,
      body: String(formData.get("body") || ""),
      product_blocks: await resolveProducts(formData, (current.product_blocks ?? []) as ProductBlock[]),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  refresh(current.slug);
  refresh(slug);
}

export async function setArticleStatus(id: string, status: string) {
  const user = await assertAdmin();
  if (!VALID_STATUS.has(status)) throw new Error("Invalid status");
  const admin = createServiceClient();

  const { data: article } = await admin
    .from("articles")
    .select("id, slug, title, body, opportunity_id, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!article) throw new Error("Article not found");

  if (status === "PUBLISHED" && !String(article.body || "").trim()) {
    throw new Error("This article has no body yet — write it before publishing.");
  }

  const patch: Record<string, any> = { status, updated_at: new Date().toISOString() };
  if (status === "PUBLISHED") {
    patch.author = user.email;
    // Keep the original publish date on a re-publish, so the article doesn't
    // jump to the top of the blog every time it's edited.
    patch.published_at = article.published_at ?? new Date().toISOString();
  }

  const { error } = await admin.from("articles").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  await syncOpportunity(article.opportunity_id, status);
  refresh(article.slug);
}

export async function deleteArticle(id: string) {
  await assertAdmin();
  const admin = createServiceClient();

  const { data: article } = await admin.from("articles").select("slug, opportunity_id").eq("id", id).maybeSingle();
  const { error } = await admin.from("articles").delete().eq("id", id);
  if (error) throw new Error(error.message);

  // Hand the idea back to the board so it can be planned again later.
  if (article?.opportunity_id) {
    await admin
      .from("content_opportunities")
      .update({ status: "APPROVED", updated_at: new Date().toISOString() })
      .eq("id", article.opportunity_id);
  }

  refresh(article?.slug);
}
