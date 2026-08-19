import Link from "next/link";
import { requireAdmin } from "@/utils/admin";
import { createServiceClient } from "@/utils/supabase/admin";
import { Sparkles, TrendingUp, Flame, Clock, Radar, ExternalLink, FileText } from "lucide-react";
import { RunButton } from "./RunButton";
import { StatusButtons } from "./StatusButtons";
import { WriteArticleButton } from "./WriteArticleButton";

export const dynamic = "force-dynamic";

const FACTOR_ORDER = [
  { key: "search", label: "Search demand" },
  { key: "growth", label: "Growth" },
  { key: "seasonal", label: "Seasonal" },
  { key: "kindlybox", label: "KindlyBox demand" },
  { key: "affiliate", label: "Affiliate" },
  { key: "competition", label: "Low competition" },
  { key: "freshness", label: "Freshness" },
];

function scoreColor(n: number) {
  if (n >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (n >= 65) return "text-accent bg-accent/10 border-accent/30";
  if (n >= 50) return "text-gray-700 bg-gray-100 border-gray-200";
  return "text-gray-400 bg-gray-50 border-gray-100";
}
function barColor(n: number) {
  if (n >= 80) return "bg-emerald-500";
  if (n >= 65) return "bg-accent";
  if (n >= 50) return "bg-gray-400";
  return "bg-gray-300";
}
// provenance dot: measured = solid green, estimated = hollow amber, else gray
function ProvenanceDot({ p }: { p?: string }) {
  if (p === "measured") return <span title="Measured from real data" className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />;
  if (p === "ai_estimated") return <span title="AI-estimated" className="inline-block w-1.5 h-1.5 rounded-full border border-amber-500" />;
  return <span title={p || ""} className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300" />;
}

export default async function IntelligencePage() {
  await requireAdmin();
  const admin = createServiceClient();

  const [{ data: opps }, { data: sources }, { data: articles }] = await Promise.all([
    admin.from("content_opportunities").select("*").neq("status", "ARCHIVED").order("overall_score", { ascending: false }),
    admin.from("trend_sources").select("source_name, source_type, active, last_checked, last_status").order("active", { ascending: false }),
    admin.from("articles").select("id, slug, status, opportunity_id"),
  ]);

  const list = opps ?? [];
  // Opportunities that already have a draft link straight to it instead of
  // offering to write a second one.
  const articleByOpp = new Map(
    (articles ?? []).filter((a) => a.opportunity_id).map((a) => [a.opportunity_id as string, a]),
  );
  const activeSources = (sources ?? []).filter((s) => s.active);
  const lastChecked = (sources ?? []).map((s) => s.last_checked).filter(Boolean).sort().pop();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Radar className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary">Gift Intelligence</h1>
            <p className="text-gray-500 mt-0.5">
              Today&apos;s top content opportunities, scored from real demand signals.
            </p>
          </div>
        </div>
        <RunButton />
      </div>

      {/* Sources strip */}
      <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="font-semibold text-gray-700 inline-flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-accent" /> Active sources:
        </span>
        {activeSources.map((s) => (
          <span key={s.source_name} className="inline-flex items-center gap-1.5 text-gray-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {s.source_name}
          </span>
        ))}
        <span className="ml-auto text-xs text-gray-400 inline-flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {lastChecked ? `Last run ${new Date(lastChecked).toLocaleString()}` : "Never run yet"}
        </span>
      </div>

      {/* Opportunities */}
      {list.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1 font-medium">No opportunities yet.</p>
          <p className="text-gray-400 text-sm">Click <span className="font-semibold">Run engine now</span> to scan sources and score your first batch.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((o, i) => {
            const factors = (o.score_breakdown?.factors ?? {}) as Record<string, { score: number; provenance?: string }>;
            const products = (o.recommended_products ?? []) as { gift_id: string; name: string; affiliate_url: string | null }[];
            return (
              <div key={o.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start gap-4">
                  {/* Rank + score */}
                  <div className="flex flex-col items-center flex-shrink-0 w-14">
                    <span className="text-xs text-gray-400 font-medium mb-1">#{i + 1}</span>
                    <div className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center font-bold ${scoreColor(o.overall_score)}`}>
                      <span className="text-xl leading-none">{o.overall_score}</span>
                      <span className="text-[9px] font-medium opacity-70">/100</span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-grow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-serif text-lg font-bold text-primary leading-snug">{o.suggested_title || o.topic}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {o.category ? null : null}
                          <span className="capitalize">{o.content_type?.replace(/_/g, " ")}</span>
                          {o.primary_keyword ? <> · keyword: <span className="font-medium text-gray-500">{o.primary_keyword}</span></> : null}
                        </p>
                      </div>
                      {o.overall_score >= 80 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 flex-shrink-0">
                          <Flame className="w-3 h-3" /> HOT
                        </span>
                      )}
                    </div>

                    {/* Why now */}
                    <div className="mt-3 rounded-xl bg-accent/5 border border-accent/15 px-3.5 py-2.5">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-accent mb-0.5">Why now</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{o.why_now}</p>
                    </div>

                    {/* Factor bars */}
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                      {FACTOR_ORDER.map((f) => {
                        const val = o[`${f.key}_score`] ?? factors[f.key]?.score ?? 0;
                        return (
                          <div key={f.key}>
                            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-0.5">
                              <span className="inline-flex items-center gap-1"><ProvenanceDot p={factors[f.key]?.provenance} /> {f.label}</span>
                              <span className="font-semibold text-gray-600">{val}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div className={`h-full rounded-full ${barColor(val)}`} style={{ width: `${val}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Products + actions */}
                    <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        {products.length > 0 && (
                          <>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Recommended products</p>
                            <div className="flex flex-wrap gap-1.5">
                              {products.map((p) => (
                                <span key={p.gift_id} className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
                                  {p.name}
                                  {p.affiliate_url && <ExternalLink className="w-3 h-3 text-accent" />}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 flex-wrap justify-end">
                        {(() => {
                          const article = articleByOpp.get(o.id);
                          if (article) {
                            return (
                              <Link
                                href={`/dashboard/articles/${article.id}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 text-gray-600 px-3.5 py-1.5 text-xs font-semibold hover:text-accent hover:border-accent/40 transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                {article.status === "PUBLISHED" ? "View article" : "Edit draft"}
                              </Link>
                            );
                          }
                          return o.status === "APPROVED" ? <WriteArticleButton opportunityId={o.id} /> : null;
                        })()}
                        <StatusButtons id={o.id} status={o.status} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Provenance legend */}
      <div className="mt-6 flex items-center gap-5 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Measured from real data</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full border border-amber-500" /> AI-estimated</span>
      </div>
    </div>
  );
}
