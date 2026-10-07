import Link from "next/link";
import { requireAdmin } from "@/utils/admin";
import { createServiceClient } from "@/utils/supabase/admin";
import { Store, Building2, Clock, ExternalLink, Tag, ChevronLeft, ChevronRight, Search, Check, X, ClipboardCheck } from "lucide-react";
import { SyncButton } from "./SyncButton";
import { setProductStatus, bulkSetStatus } from "./actions";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 48;
const STATUSES = ["approved", "staged", "rejected", "all"] as const;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | undefined>;
}) {
  await requireAdmin();
  const admin = createServiceClient();

  const status = STATUSES.includes((searchParams?.status as any)) ? searchParams!.status! : "approved";
  const merchant = searchParams?.merchant || "";
  const category = searchParams?.category || "";
  const tag = searchParams?.tag || "";
  const q = (searchParams?.q || "").trim();
  const pmin = searchParams?.pmin || "";
  const pmax = searchParams?.pmax || "";
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [{ count: stagedCount }, { data: lastRun }, { data: catRows }] = await Promise.all([
    admin.from("products").select("id", { count: "exact", head: true }).eq("active", true).eq("status", "staged"),
    admin.from("affiliate_sync_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("products").select("category").eq("active", true).not("category", "is", null).limit(3000),
  ]);

  const perFeed: { advertiser: string; kept: number }[] = lastRun?.detail?.per_feed ?? [];
  const merchants = Array.from(new Set(perFeed.map((f) => f.advertiser))).sort();
  const categories = Array.from(new Set((catRows || []).map((c: any) => c.category).filter(Boolean))).sort().slice(0, 40);

  // Filtered, paginated product query.
  let query = admin
    .from("products")
    .select("id, title, price, currency, image_url, tags, merchant_name, category, status, affiliate_link", { count: "exact" })
    .eq("active", true);
  if (status !== "all") query = query.eq("status", status);
  if (merchant) query = query.eq("merchant_name", merchant);
  if (category) query = query.eq("category", category);
  if (tag) query = query.contains("tags", [tag]);
  if (q) query = query.ilike("title", `%${q}%`);
  if (pmin) query = query.gte("price", Number(pmin));
  if (pmax) query = query.lte("price", Number(pmax));
  const { data: products, count: filteredCount } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const total = filteredCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const list = products ?? [];

  const urlFor = (patch: Record<string, string | undefined>) => {
    const base: Record<string, string | undefined> = { status, merchant, category, tag, q, pmin, pmax, page: String(page), ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    const s = p.toString();
    return `/dashboard/products${s ? `?${s}` : ""}`;
  };
  const filtered = Boolean(merchant || category || tag || q || pmin || pmax || status !== "approved");
  const badge = (s: string) =>
    s === "approved" ? "bg-emerald-100 text-emerald-700"
    : s === "staged" ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-700";

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
            <p className="text-gray-500 mt-0.5">Review, approve, and manage products from your affiliate networks.</p>
          </div>
        </div>
        <SyncButton />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <Link href={urlFor({ status: "staged", page: undefined })} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100 transition-colors">
          <div className="flex items-center gap-2 text-amber-600 text-xs font-semibold uppercase tracking-wide mb-1"><ClipboardCheck className="w-4 h-4" /> Awaiting review</div>
          <div className="text-2xl font-bold text-amber-700">{(stagedCount ?? 0).toLocaleString()}</div>
        </Link>
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1"><Building2 className="w-4 h-4" /> Merchants</div>
          <div className="text-2xl font-bold text-primary">{merchants.length}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1"><Clock className="w-4 h-4" /> Last sync</div>
          <div className="text-sm font-medium text-gray-700">{lastRun?.finished_at ? new Date(lastRun.finished_at).toLocaleString() : "Never"}</div>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {STATUSES.map((s) => (
          <Link key={s} href={urlFor({ status: s, page: undefined })} className={`text-sm rounded-lg px-3 py-1.5 border capitalize ${status === s ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
            {s}{s === "staged" && (stagedCount ?? 0) > 0 ? ` (${stagedCount})` : ""}
          </Link>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 mb-6 space-y-3">
        <form action="/dashboard/products" method="get" className="flex flex-wrap gap-2 items-center">
          <input type="hidden" name="status" value={status} />
          {merchant && <input type="hidden" name="merchant" value={merchant} />}
          {category && <input type="hidden" name="category" value={category} />}
          {tag && <input type="hidden" name="tag" value={tag} />}
          <div className="relative flex-grow min-w-[180px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input name="q" defaultValue={q} placeholder="Search titles…" className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <input name="pmin" defaultValue={pmin} placeholder="$ min" type="number" className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <input name="pmax" defaultValue={pmax} placeholder="$ max" type="number" className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <button className="rounded-xl bg-primary text-white px-4 py-2 text-sm font-semibold hover:bg-primary/90">Apply</button>
        </form>

        {/* Merchant chips */}
        <div className="flex flex-wrap gap-1.5">
          <Link href={urlFor({ merchant: undefined, page: undefined })} className={`text-xs rounded-lg px-2.5 py-1 border ${!merchant ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}>All merchants</Link>
          {merchants.map((m) => (
            <Link key={m} href={urlFor({ merchant: m, page: undefined })} className={`text-xs rounded-lg px-2.5 py-1 border truncate max-w-[220px] ${merchant === m ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}>{m}</Link>
          ))}
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Link href={urlFor({ category: undefined, page: undefined })} className={`text-xs rounded-lg px-2.5 py-1 border ${!category ? "bg-accent text-white border-accent" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}>All categories</Link>
            {categories.map((c) => (
              <Link key={c} href={urlFor({ category: c, page: undefined })} className={`text-xs rounded-lg px-2.5 py-1 border truncate max-w-[200px] ${category === c ? "bg-accent text-white border-accent" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}>{c}</Link>
            ))}
          </div>
        )}
      </div>

      {/* Result count + bulk actions */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-700">{total.toLocaleString()}</span> product{total === 1 ? "" : "s"}
          {filtered ? " (filtered)" : ""} · page {page} of {totalPages}
          {filtered && <Link href="/dashboard/products" className="ml-2 text-xs text-accent hover:underline">Clear</Link>}
        </p>
        {total > 0 && (
          <form className="flex items-center gap-2">
            <input type="hidden" name="f_status" value={status === "all" ? "" : status} />
            <input type="hidden" name="f_merchant" value={merchant} />
            <input type="hidden" name="f_category" value={category} />
            <input type="hidden" name="f_q" value={q} />
            <input type="hidden" name="f_pmin" value={pmin} />
            <input type="hidden" name="f_pmax" value={pmax} />
            <span className="text-xs text-gray-400">Bulk ({total}):</span>
            <button formAction={bulkSetStatus} name="status" value="approved" className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700"><Check className="w-3.5 h-3.5" /> Approve all</button>
            <button formAction={bulkSetStatus} name="status" value="rejected" className="inline-flex items-center gap-1 rounded-lg bg-red-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-red-700"><X className="w-3.5 h-3.5" /> Reject all</button>
          </form>
        )}
      </div>

      {/* Product grid */}
      {list.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <Store className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No products match.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {list.map((p: any) => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
              <div className="aspect-square bg-gray-50 overflow-hidden relative">
                <span className={`absolute top-2 left-2 z-10 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${badge(p.status)}`}>{p.status}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.image_url ? <img src={p.image_url} alt={p.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-contain" /> : null}
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
                <div className="mt-auto pt-2 border-t border-gray-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 truncate max-w-[55%]">{p.merchant_name}</span>
                    <a href={p.affiliate_link} target="_blank" rel="sponsored nofollow noopener" className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">View <ExternalLink className="w-3 h-3" /></a>
                  </div>
                  <div className="flex gap-1.5">
                    {p.status !== "approved" && (
                      <form action={setProductStatus} className="flex-1">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="status" value="approved" />
                        <button className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 text-xs font-semibold hover:bg-emerald-100"><Check className="w-3.5 h-3.5" /> Approve</button>
                      </form>
                    )}
                    {p.status !== "rejected" && (
                      <form action={setProductStatus} className="flex-1">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <button className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-red-50 text-red-700 border border-red-200 px-2 py-1 text-xs font-semibold hover:bg-red-100"><X className="w-3.5 h-3.5" /> Reject</button>
                      </form>
                    )}
                  </div>
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
