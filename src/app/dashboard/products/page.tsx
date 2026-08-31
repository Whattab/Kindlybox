import Link from "next/link";
import { requireAdmin } from "@/utils/admin";
import { createServiceClient } from "@/utils/supabase/admin";
import { TAGS } from "@/lib/gift-vocab";
import { Store, Boxes, Building2, Clock, ExternalLink, Tag, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { SyncButton } from "./SyncButton";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 48;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | undefined>;
}) {
  await requireAdmin();
  const admin = createServiceClient();

  const merchant = searchParams?.merchant || "";
  const tag = searchParams?.tag || "";
  const q = (searchParams?.q || "").trim();
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [{ count: activeCount }, { data: lastRun }] = await Promise.all([
    admin.from("products").select("*", { count: "exact", head: true }).eq("active", true),
    admin.from("affiliate_sync_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  // Unique merchant names for the filter (deduped from the last run's per-feed list).
  const perFeed: { advertiser: string; kept: number }[] = lastRun?.detail?.per_feed ?? [];
  const merchants = Array.from(new Set(perFeed.map((f) => f.advertiser))).sort();

  // Filtered, paginated product query.
  let query = admin
    .from("products")
    .select("id, title, price, currency, image_url, tags, merchant_name, affiliate_link", { count: "exact" })
    .eq("active", true)
    .not("image_url", "is", null);
  if (merchant) query = query.eq("merchant_name", merchant);
  if (tag) query = query.contains("tags", [tag]);
  if (q) query = query.ilike("title", `%${q}%`);
  const { data: products, count: filteredCount } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const total = filteredCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const list = products ?? [];

  // Build URLs preserving filters.
  const urlFor = (patch: Record<string, string | undefined>) => {
    const base: Record<string, string | undefined> = { merchant, tag, q, page: String(page), ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    const s = p.toString();
    return `/dashboard/products${s ? `?${s}` : ""}`;
  };
  const filtered = Boolean(merchant || tag || q);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary">Affiliate Products</h1>
            <p className="text-gray-500 mt-0.5">Live catalog pulled from your affiliate networks.</p>
          </div>
        </div>
        <SyncButton />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1"><Boxes className="w-4 h-4" /> Active products</div>
          <div className="text-2xl font-bold text-primary">{(activeCount ?? 0).toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1"><Building2 className="w-4 h-4" /> Merchants</div>
          <div className="text-2xl font-bold text-primary">{merchants.length}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1"><Clock className="w-4 h-4" /> Last sync</div>
          <div className="text-sm font-medium text-gray-700">{lastRun?.finished_at ? new Date(lastRun.finished_at).toLocaleString() : "Never"}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 mb-6 space-y-3">
        {/* Search */}
        <form action="/dashboard/products" method="get" className="flex gap-2">
          {merchant && <input type="hidden" name="merchant" value={merchant} />}
          {tag && <input type="hidden" name="tag" value={tag} />}
          <div className="relative flex-grow">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input name="q" defaultValue={q} placeholder="Search product titles…"
              className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <button className="rounded-xl bg-primary text-white px-4 py-2 text-sm font-semibold hover:bg-primary/90">Search</button>
        </form>

        {/* Merchant chips */}
        <div className="flex flex-wrap gap-1.5">
          <Link href={urlFor({ merchant: undefined, page: undefined })} className={`text-xs rounded-lg px-2.5 py-1 border ${!merchant ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}>All merchants</Link>
          {merchants.map((m) => (
            <Link key={m} href={urlFor({ merchant: m, page: undefined })} className={`text-xs rounded-lg px-2.5 py-1 border truncate max-w-[220px] ${merchant === m ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}>{m}</Link>
          ))}
        </div>

        {/* Tag chips */}
        <div className="flex flex-wrap gap-1.5">
          <Link href={urlFor({ tag: undefined, page: undefined })} className={`text-xs rounded-lg px-2.5 py-1 border ${!tag ? "bg-accent text-white border-accent" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}>All tags</Link>
          {TAGS.map((t) => (
            <Link key={t} href={urlFor({ tag: t, page: undefined })} className={`text-xs rounded-lg px-2.5 py-1 border ${tag === t ? "bg-accent text-white border-accent" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}>{t}</Link>
          ))}
        </div>
      </div>

      {/* Result count + pagination top */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-700">{total.toLocaleString()}</span> product{total === 1 ? "" : "s"}
          {filtered ? " (filtered)" : ""} · page {page} of {totalPages}
        </p>
        {filtered && <Link href="/dashboard/products" className="text-xs text-accent hover:underline">Clear filters</Link>}
      </div>

      {/* Product grid */}
      {list.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <Store className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No products match.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {list.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
              <div className="aspect-square bg-gray-50 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url!} alt={p.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-contain" />
              </div>
              <div className="p-3 flex flex-col flex-grow">
                <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug mb-1">{p.title}</p>
                <p className="text-primary font-bold text-sm mb-2">{p.currency === "USD" ? "$" : ""}{p.price}{p.currency !== "USD" ? ` ${p.currency}` : ""}</p>
                {p.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {p.tags.slice(0, 2).map((t: string) => (
                      <span key={t} className="inline-flex items-center gap-0.5 text-[10px] bg-accent/10 text-accent rounded px-1.5 py-0.5"><Tag className="w-2.5 h-2.5" />{t}</span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between pt-2 border-t border-gray-50">
                  <span className="text-[11px] text-gray-400 truncate max-w-[55%]">{p.merchant_name}</span>
                  <a href={p.affiliate_link} target="_blank" rel="sponsored nofollow noopener" className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">View <ExternalLink className="w-3 h-3" /></a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          {page > 1 ? (
            <Link href={urlFor({ page: String(page - 1) })} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /> Prev</Link>
          ) : <span className="inline-flex items-center gap-1 rounded-xl border border-gray-100 px-4 py-2 text-sm text-gray-300"><ChevronLeft className="w-4 h-4" /> Prev</span>}
          <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
          {page < totalPages ? (
            <Link href={urlFor({ page: String(page + 1) })} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Next <ChevronRight className="w-4 h-4" /></Link>
          ) : <span className="inline-flex items-center gap-1 rounded-xl border border-gray-100 px-4 py-2 text-sm text-gray-300">Next <ChevronRight className="w-4 h-4" /></span>}
        </div>
      )}
    </div>
  );
}
