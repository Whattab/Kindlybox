import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/utils/admin";
import { createServiceClient } from "@/utils/supabase/admin";
import { SubmitButton } from "@/components/SubmitButton";
import { ArrowLeft, ExternalLink, Sparkles, Info } from "lucide-react";
import { saveArticle } from "../actions";
import { ArticleActions } from "./ArticleActions";
import type { ProductBlock } from "@/lib/intelligence/writer";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "text-gray-600 bg-gray-100 border-gray-200",
  REVIEW: "text-amber-700 bg-amber-50 border-amber-200",
  PUBLISHED: "text-emerald-700 bg-emerald-50 border-emerald-200",
  ARCHIVED: "text-gray-400 bg-gray-50 border-gray-100",
};

const field = "w-full rounded-xl border-gray-200 text-sm text-gray-800 focus:border-accent focus:ring-accent";
const label = "block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5";

export default async function ArticleEditorPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const admin = createServiceClient();

  const { data: article } = await admin.from("articles").select("*").eq("id", params.id).maybeSingle();
  if (!article) return notFound();

  const { data: opp } = article.opportunity_id
    ? await admin
        .from("content_opportunities")
        .select("topic, overall_score, why_now, primary_keyword")
        .eq("id", article.opportunity_id)
        .maybeSingle()
    : { data: null };

  const blocks = (article.product_blocks ?? []) as ProductBlock[];
  const save = saveArticle.bind(null, article.id);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/dashboard/articles" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-accent mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Articles
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <span className={`text-[11px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${STATUS_STYLE[article.status] || STATUS_STYLE.DRAFT}`}>
              {article.status}
            </span>
            {article.generated_by && (
              <span className="text-xs text-gray-400 inline-flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                {article.generated_by === "template" ? "Templated draft — AI was unavailable" : `Drafted by ${article.generated_by}`}
              </span>
            )}
            {article.status === "PUBLISHED" && (
              <Link href={`/blog/${article.slug}`} target="_blank" className="text-xs font-semibold text-accent inline-flex items-center gap-1 hover:underline">
                <ExternalLink className="w-3.5 h-3.5" /> View live
              </Link>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-primary leading-tight">{article.title}</h1>
        </div>
        <ArticleActions id={article.id} status={article.status} />
      </div>

      {/* Why this article exists — carried over from the opportunity that scored it. */}
      {opp && (
        <div className="mb-6 rounded-2xl border border-accent/15 bg-accent/5 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-accent mb-0.5">
            Why now · opportunity scored {opp.overall_score}/100
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{opp.why_now}</p>
        </div>
      )}

      <form action={save} className="space-y-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-primary/5 border border-gray-100 space-y-5">
          <div>
            <label className={label} htmlFor="title">Title</label>
            <input id="title" name="title" defaultValue={article.title} required className={field} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={label} htmlFor="slug">URL slug</label>
              <input id="slug" name="slug" defaultValue={article.slug} className={field} />
              <p className="text-xs text-gray-400 mt-1">kindlybox.com/blog/{article.slug}</p>
            </div>
            <div>
              <label className={label} htmlFor="hero_image_url">Hero image URL</label>
              <input id="hero_image_url" name="hero_image_url" defaultValue={article.hero_image_url ?? ""} className={field} placeholder="https://…" />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="meta_description">Meta description (Google snippet)</label>
            <textarea id="meta_description" name="meta_description" rows={2} defaultValue={article.meta_description ?? ""} className={field} />
            <p className="text-xs text-gray-400 mt-1">Aim for 140–155 characters.</p>
          </div>

          <div>
            <label className={label} htmlFor="excerpt">Excerpt (blog index card)</label>
            <textarea id="excerpt" name="excerpt" rows={2} defaultValue={article.excerpt ?? ""} className={field} />
          </div>

          <div>
            <label className={label} htmlFor="body">Article body</label>
            <textarea id="body" name="body" rows={22} defaultValue={article.body ?? ""} className={`${field} font-mono text-[13px] leading-relaxed`} />
            <p className="text-xs text-gray-400 mt-1.5 inline-flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                Markdown: <code className="bg-gray-100 px-1 rounded">## Heading</code>,{" "}
                <code className="bg-gray-100 px-1 rounded">- bullet</code>,{" "}
                <code className="bg-gray-100 px-1 rounded">**bold**</code>. The line{" "}
                <code className="bg-gray-100 px-1 rounded">{"{{products}}"}</code> is where the gift cards appear — move it to move them.
              </span>
            </p>
          </div>
        </div>

        {/* Product blurbs — the products themselves come from the catalogue. */}
        {blocks.length > 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-primary/5 border border-gray-100">
            <h2 className="font-serif text-xl font-bold text-primary mb-1">Featured gifts</h2>
            <p className="text-sm text-gray-500 mb-5">
              Pulled from your catalogue. Each links through <code className="bg-gray-100 px-1 rounded text-xs">/go/</code> so affiliate URLs stay editable in the catalogue.
            </p>
            <div className="space-y-5">
              {blocks.map((b, i) => (
                <div key={b.gift_id} className="border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <span className="text-xs font-semibold text-gray-400">#{i + 1} · {b.name}</span>
                    {b.slug ? (
                      <Link href={`/go/${b.slug}`} target="_blank" className="text-xs text-gray-400 hover:text-accent inline-flex items-center gap-1">
                        <ExternalLink className="w-3.5 h-3.5" /> /go/{b.slug}
                      </Link>
                    ) : (
                      <span className="text-xs text-amber-600" title="This gift has no slug, so it can't be linked">No link yet</span>
                    )}
                  </div>
                  <input name={`heading_${b.gift_id}`} defaultValue={b.heading} className={`${field} mb-2 font-semibold`} />
                  <textarea name={`blurb_${b.gift_id}`} rows={3} defaultValue={b.blurb} className={field} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <SubmitButton pendingText="Saving…" className="px-6 py-2.5">Save changes</SubmitButton>
        </div>
      </form>
    </div>
  );
}
