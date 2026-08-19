import Link from "next/link";
import { requireAdmin } from "@/utils/admin";
import { createServiceClient } from "@/utils/supabase/admin";
import { FileText, ExternalLink, Radar, PenLine } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  OUTLINE: "text-sky-700 bg-sky-50 border-sky-200",
  DRAFT: "text-gray-600 bg-gray-100 border-gray-200",
  REVIEW: "text-amber-700 bg-amber-50 border-amber-200",
  PUBLISHED: "text-emerald-700 bg-emerald-50 border-emerald-200",
  ARCHIVED: "text-gray-400 bg-gray-50 border-gray-100",
};

export default async function ArticlesPage() {
  await requireAdmin();
  const admin = createServiceClient();

  const { data: articles } = await admin
    .from("articles")
    .select("id, slug, title, excerpt, status, generated_by, published_at, updated_at, product_blocks")
    .order("updated_at", { ascending: false });

  const list = articles ?? [];
  const counts = list.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary">Articles</h1>
            <p className="text-gray-500 mt-0.5">
              {list.length === 0
                ? "Articles planned from approved gift opportunities land here."
                : `${counts.PUBLISHED || 0} published · ${counts.REVIEW || 0} in review · ${counts.DRAFT || 0} draft · ${counts.OUTLINE || 0} outlined`}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/intelligence"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-accent hover:border-accent/40 transition-colors"
        >
          <Radar className="w-4 h-4" /> Gift Intelligence
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <PenLine className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1 font-medium">No articles yet.</p>
          <p className="text-gray-400 text-sm">
            Approve an opportunity in{" "}
            <Link href="/dashboard/intelligence" className="text-accent font-semibold hover:underline">
              Gift Intelligence
            </Link>{" "}
            and click <span className="font-semibold">Plan article</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
              <div className="min-w-0 flex-grow">
                <div className="flex items-center gap-2.5 flex-wrap mb-1">
                  <span className={`text-[11px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${STATUS_STYLE[a.status] || STATUS_STYLE.DRAFT}`}>
                    {a.status}
                  </span>
                  {a.generated_by === "template" && (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      Needs a human pass
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {((a.product_blocks as any[]) || []).length} products
                  </span>
                </div>
                <Link href={`/dashboard/articles/${a.id}`} className="font-serif text-lg font-bold text-primary leading-snug hover:text-accent transition-colors">
                  {a.title}
                </Link>
                {a.excerpt && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.excerpt}</p>}
                <p className="text-xs text-gray-400 mt-2">
                  /blog/{a.slug}
                  {a.published_at ? ` · published ${new Date(a.published_at).toLocaleDateString()}` : ""}
                  {a.updated_at ? ` · edited ${new Date(a.updated_at).toLocaleDateString()}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {a.status === "PUBLISHED" && (
                  <Link
                    href={`/blog/${a.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent border border-gray-200 rounded-lg px-3 py-2 transition-colors"
                    title="View live article"
                  >
                    <ExternalLink className="w-4 h-4" /> View
                  </Link>
                )}
                <Link
                  href={`/dashboard/articles/${a.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-white px-3.5 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  <PenLine className="w-4 h-4" /> Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
