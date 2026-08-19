import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { GiftImage } from "@/components/GiftImage";
import { ArrowRight, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gift Guides · KindlyBox",
  description:
    "Thoughtful, up-to-date gift guides from KindlyBox — real picks for real people, for every occasion.",
};

export default async function BlogIndexPage() {
  // Anon client on purpose: RLS only exposes PUBLISHED articles, so a draft can
  // never leak onto the public blog even if it's linked directly.
  const supabase = createClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("slug, title, excerpt, hero_image_url, published_at, content_type")
    .eq("status", "PUBLISHED")
    .order("published_at", { ascending: false });

  const list = articles ?? [];
  const [lead, ...rest] = list;

  return (
    <main className="min-h-screen bg-background flex flex-col font-sans">
      <SiteNav />

      <div className="flex-grow px-6 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500 mb-3.5">
              Gift guides
            </p>
            <h1 className="font-serif font-semibold text-4xl lg:text-5xl leading-tight text-primary mb-4">
              Ideas worth wrapping.
            </h1>
            <p className="text-base leading-relaxed text-gray-500 max-w-[520px] mx-auto">
              Practical gift guides built from what people are actually shopping for — every pick
              drawn from the KindlyBox catalogue.
            </p>
          </div>

          {list.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 max-w-2xl mx-auto">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium mb-1">No guides published yet.</p>
              <p className="text-gray-400 text-sm">
                New gift guides land here soon — in the meantime,{" "}
                <Link href="/quiz" className="text-accent font-semibold hover:underline">
                  take the gift quiz
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              {/* Lead article */}
              <Link
                href={`/blog/${lead.slug}`}
                className="group block bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-xl shadow-primary/5 mb-8 sm:flex"
              >
                <div className="relative w-full sm:w-2/5 aspect-[16/10] sm:aspect-auto sm:min-h-[260px] bg-gray-100 flex-shrink-0">
                  <GiftImage src={lead.hero_image_url} alt={lead.title} />
                </div>
                <div className="p-7 sm:p-9 flex flex-col justify-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent mb-2">
                    Latest guide
                  </p>
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-primary leading-snug group-hover:text-accent transition-colors">
                    {lead.title}
                  </h2>
                  {lead.excerpt && <p className="text-gray-500 mt-3 leading-relaxed">{lead.excerpt}</p>}
                  <span className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold text-accent">
                    Read the guide <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>

              {/* The rest */}
              {rest.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rest.map((a) => (
                    <Link
                      key={a.slug}
                      href={`/blog/${a.slug}`}
                      className="group block bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all hover:-translate-y-0.5"
                    >
                      <div className="relative aspect-[16/10] bg-gray-100">
                        <GiftImage src={a.hero_image_url} alt={a.title} />
                      </div>
                      <div className="p-5">
                        <h3 className="font-serif text-lg font-bold text-primary leading-snug group-hover:text-accent transition-colors">
                          {a.title}
                        </h3>
                        {a.excerpt && <p className="text-sm text-gray-500 mt-2 line-clamp-3 leading-relaxed">{a.excerpt}</p>}
                        {a.published_at && (
                          <p className="text-xs text-gray-400 mt-3">
                            {new Date(a.published_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
