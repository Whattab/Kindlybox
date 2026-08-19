"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/utils/admin";
import { createServiceClient } from "@/utils/supabase/admin";
import { generateArticleDraft, uniqueSlug, slugify } from "@/lib/intelligence/writer";

const VALID_STATUS = new Set(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]);

// Keep the opportunity's status in step with its article, so the Gift
// Intelligence board reflects what actually happened to each idea.
const OPP_STATUS_FOR: Record<string, string> = {
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

// Draft an article from an approved opportunity. If one already exists we just
// hand back its id — clicking twice must never produce a duplicate.
export async function writeArticleFromOpportunity(opportunityId: string): Promise<string> {
  await assertAdmin();
  const admin = createServiceClient();

  const { data: existing } = await admin
    .from("articles")
    .select("id")
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (existing) return existing.id;

  const draft = await generateArticleDraft(opportunityId);

  const { data, error } = await admin
    .from("articles")
    .insert({ ...draft, opportunity_id: opportunityId, generated_at: new Date().toISOString(), status: "DRAFT" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await admin
    .from("content_opportunities")
    .update({ status: "WRITING", updated_at: new Date().toISOString() })
    .eq("id", opportunityId);

  refresh();
  return data.id;
}

// Re-run the writer over the same opportunity, keeping the article's slug so
// any link already shared stays valid.
export async function regenerateArticle(id: string) {
  await assertAdmin();
  const admin = createServiceClient();

  const { data: article } = await admin
    .from("articles")
    .select("id, slug, opportunity_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!article) throw new Error("Article not found");
  if (!article.opportunity_id) throw new Error("This article is not linked to an opportunity, so it can't be regenerated.");
  if (article.status === "PUBLISHED") throw new Error("Unpublish before regenerating, so live copy is never overwritten.");

  const draft = await generateArticleDraft(article.opportunity_id);
  const { slug, ...rest } = draft; // keep the existing slug
  const { error } = await admin
    .from("articles")
    .update({ ...rest, generated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  refresh(article.slug);
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

  // Product blurbs come back as blurb_<gift_id> / heading_<gift_id> fields.
  const blocks = ((current.product_blocks ?? []) as any[]).map((b) => ({
    ...b,
    heading: String(formData.get(`heading_${b.gift_id}`) ?? b.heading).slice(0, 90),
    blurb: String(formData.get(`blurb_${b.gift_id}`) ?? b.blurb),
  }));

  const { error } = await admin
    .from("articles")
    .update({
      title,
      slug,
      meta_description: String(formData.get("meta_description") || "").slice(0, 300),
      excerpt: String(formData.get("excerpt") || "").slice(0, 400),
      hero_image_url: String(formData.get("hero_image_url") || "") || null,
      body: String(formData.get("body") || ""),
      product_blocks: blocks,
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
    throw new Error("This article has no body yet — add some copy before publishing.");
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

  if (article.opportunity_id && OPP_STATUS_FOR[status]) {
    await admin
      .from("content_opportunities")
      .update({ status: OPP_STATUS_FOR[status], updated_at: new Date().toISOString() })
      .eq("id", article.opportunity_id);
  }

  refresh(article.slug);
}

export async function deleteArticle(id: string) {
  await assertAdmin();
  const admin = createServiceClient();

  const { data: article } = await admin.from("articles").select("slug, opportunity_id").eq("id", id).maybeSingle();
  const { error } = await admin.from("articles").delete().eq("id", id);
  if (error) throw new Error(error.message);

  // Hand the idea back to the board so it can be written again later.
  if (article?.opportunity_id) {
    await admin
      .from("content_opportunities")
      .update({ status: "APPROVED", updated_at: new Date().toISOString() })
      .eq("id", article.opportunity_id);
  }

  refresh(article?.slug);
}
