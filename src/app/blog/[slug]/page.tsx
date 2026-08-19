import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { GiftImage } from "@/components/GiftImage";
import { Markdown } from "@/components/Markdown";
import { PRODUCTS_TOKEN, extractFaq, type ProductBlock } from "@/lib/intelligence/writer";
import { ArrowRight, ArrowLeft, Sparkles, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

// Other published guides to point at, preferring ones that share a keyword.
// Internal links are what make a growing blog compound.
async function relatedGuides(article: any, limit = 3) {
  const supabase = createClient();
  const { data } = await supabase
    .from("articles")
    .select("slug, title, excerpt, primary_keyword, secondary_keywords, published_at")
    .eq("status", "PUBLISHED")
    .neq("slug", article.slug)
    .order("published_at", { ascending: false })
    .limit(24);

  const mine = new Set(
    [article.primary_keyword, ...(article.secondary_keywords ?? [])]
      .filter(Boolean)
      .map((k: string) => k.toLowerCase()),
  );
  const overlap = (a: any) =>
    [a.primary_keyword, ...(a.secondary_keywords ?? [])]
      .filter(Boolean)
      .filter((k: string) => mine.has(k.toLowerCase())).length;

  return (data ?? []).sort((a, b) => overlap(b) - overlap(a)).slice(0, limit);
}

async function getArticle(slug: string) {
  // Anon client: RLS restricts this to PUBLISHED rows, so an unpublished draft
  // 404s here even for a signed-in admin who guesses the URL.
  const supabase = createClient();
  const { data } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "PUBLISHED")
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const article = await getArticle(params.slug);
  if (!article) return { title: "Guide not found · KindlyBox" };

  const description = article.meta_description || article.excerpt || undefined;
  return {
    title: `${article.title} · KindlyBox`,
    description,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url: `/blog/${article.slug}`,
      images: article.hero_image_url ? [article.hero_image_url] : undefined,
      publishedTime: article.published_at ?? undefined,
    },
    twitter: {
      card: article.hero_image_url ? "summary_large_image" : "summary",
      title: article.title,
      description,
    },
  };
}

const priceLabel = (p: ProductBlock) => {
  if (p.price_min == null && p.price_max == null) return null;
  if (p.price_min != null && p.price_max != null && p.price_min !== p.price_max) return `$${p.price_min} – $${p.price_max}`;
  return `$${p.price_min ?? p.price_max}`;
};

function ProductCards({ products }: { products: ProductBlock[] }) {
  if (products.length === 0) return null;
  return (
    <div className="not-prose space-y-6 my-10">
      {products.map((p, i) => (
        <div
          key={p.gift_id}
          className="bg-[#FBF6EE] rounded-3xl p-5 sm:p-6 shadow-xl shadow-primary/5 border border-primary/5 group transition-all duration-300 hover:-translate-y-1"
        >
          <div className="flex items-start gap-4">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
              <GiftImage src={p.image_url} alt={p.name} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent mb-1">
                Pick {i + 1}
              </p>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-primary leading-tight">
                {p.heading}
              </h3>
              {p.heading !== p.name && <p className="text-sm text-gray-500 mt-1">{p.name}</p>}
            </div>
          </div>

          <p className="text-gray-600 text-sm leading-relaxed mt-4">{p.blurb}</p>

          <div className="mt-5 pt-4 border-t border-dashed border-gray-200 flex items-center justify-between gap-3 flex-wrap">
            <div className="font-semibold text-primary text-lg">{priceLabel(p) ?? "See price"}</div>
            {p.slug && (
              <Link
                href={`/go/${p.slug}`}
                target="_blank"
                rel="nofollow sponsored"
                className="inline-flex items-center gap-1.5 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-primary/90 transition-all shadow-md"
              >
                View this gift <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug);
  if (!article) return notFound();

  const products = (article.product_blocks ?? []) as ProductBlock[];
  const body = String(article.body || "");
  // The body carries a {{products}} token marking where the cards belong.
  // Without it (hand-written article), the cards go after the prose.
  const [before, after] = body.includes(PRODUCTS_TOKEN) ? body.split(PRODUCTS_TOKEN) : [body, ""];

  const related = await relatedGuides(article);

  const graph: Record<string, unknown>[] = [
    {
      "@type": "Article",
      headline: article.title,
      description: article.meta_description || article.excerpt || undefined,
      image: article.hero_image_url || undefined,
      datePublished: article.published_at || undefined,
      dateModified: article.updated_at || article.published_at || undefined,
      publisher: { "@type": "Organization", name: "KindlyBox" },
      mainEntityOfPage: { "@type": "WebPage", "@id": `/blog/${article.slug}` },
    },
  ];

  // FAQ questions are parsed back out of the body, so the structured data always
  // matches what the reader actually sees — including after hand edits.
  const faq = extractFaq(body);
  if (faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  const jsonLd = { "@context": "https://schema.org", "@graph": graph };

  return (
    <main className="min-h-screen bg-background flex flex-col font-sans">
      <SiteNav />

      {/* Structured data is generated by us from our own DB row, not user input. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="flex-grow px-6 py-14 sm:py-20">
        <div className="max-w-[720px] mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-accent mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> All gift guides
          </Link>

          <header className="mb-10">
            <h1 className="font-serif font-semibold text-4xl lg:text-5xl leading-tight text-primary mb-4">
              {article.title}
            </h1>
            {article.excerpt && (
              <p className="text-lg leading-relaxed text-gray-500">{article.excerpt}</p>
            )}
            {article.published_at && (
              <p className="text-sm text-gray-400 mt-5">
                Published{" "}
                {new Date(article.published_at).toLocaleDateString(undefined, {
                  month: "long", day: "numeric", year: "numeric",
                })}
              </p>
            )}
          </header>

          {article.hero_image_url && (
            <div className="relative w-full aspect-[16/9] rounded-3xl overflow-hidden bg-gray-100 mb-10">
              <GiftImage src={article.hero_image_url} alt={article.title} />
            </div>
          )}

          <Markdown>{before}</Markdown>
          <ProductCards products={products} />
          {after.trim() && <Markdown>{after}</Markdown>}

          {/* Related guides — internal links, generated even when the writer
              didn't work any into the prose. */}
          {related.length > 0 && (
            <div className="mt-14 border-t border-gray-200 pt-8">
              <h2 className="font-serif text-2xl font-bold text-primary mb-5 inline-flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-accent" /> More gift guides
              </h2>
              <div className="space-y-3">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="group block rounded-2xl border border-gray-100 bg-white px-5 py-4 hover:border-accent/40 transition-colors"
                  >
                    <p className="font-serif text-lg font-bold text-primary leading-snug group-hover:text-accent transition-colors">
                      {r.title}
                    </p>
                    {r.excerpt && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{r.excerpt}</p>}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quiz CTA */}
          <div className="mt-14 rounded-3xl bg-[#F8F3E5] border border-[#D9C9A3] p-8 sm:p-10 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg,#D8B144,#8B2942)" }}
            >
              <Sparkles className="w-5 h-5 text-[#FBF6EA]" />
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-primary mb-2.5">
              Still not sure what to get?
            </h2>
            <p className="text-gray-500 max-w-[440px] mx-auto mb-6 leading-relaxed">
              Answer a few questions about who you&apos;re shopping for and we&apos;ll match them to
              specific gifts — with a personal note on why each one fits.
            </p>
            <Link
              href="/quiz"
              className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-7 py-3.5 rounded-full hover:bg-primary/90 transition-all shadow-md"
            >
              Take the gift quiz <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}
