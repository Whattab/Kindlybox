"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Search, Plus, X, ChevronUp, ChevronDown, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { searchGifts } from "../actions";
import type { ProductBlock } from "@/lib/intelligence/writer";

// Lets you change WHICH gifts an article features, not just how they're
// described. The chosen ids ride along with the form as a hidden field, in
// display order; the server action keeps existing copy for gifts you kept.
export function ProductPicker({
  initial,
  editCopy = true,
}: {
  initial: ProductBlock[];
  editCopy?: boolean;
}) {
  const [blocks, setBlocks] = useState<ProductBlock[]>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductBlock[] | null>(null);
  const [pending, start] = useTransition();

  const chosen = new Set(blocks.map((b) => b.gift_id));

  const search = () =>
    start(async () => {
      try {
        setResults(await searchGifts(query));
      } catch {
        setResults([]);
      }
    });

  const move = (i: number, dir: -1 | 1) => {
    const next = [...blocks];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };

  return (
    <div>
      <input type="hidden" name="product_ids" value={blocks.map((b) => b.gift_id).join(",")} />

      {blocks.length === 0 && (
        <p className="text-sm text-gray-400 mb-4">No gifts on this article yet — search the catalogue below.</p>
      )}

      <div className="space-y-4">
        {blocks.map((b, i) => (
          <div key={b.gift_id} className="border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <span className="text-xs font-semibold text-gray-400 min-w-0 truncate">#{i + 1} · {b.name}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {b.slug ? (
                  <Link href={`/go/${b.slug}`} target="_blank" className="text-xs text-gray-400 hover:text-accent inline-flex items-center gap-1 mr-1">
                    <ExternalLink className="w-3.5 h-3.5" /> /go/{b.slug}
                  </Link>
                ) : (
                  <span className="text-xs text-amber-600 inline-flex items-center gap-1 mr-1" title="This gift has no slug in the catalogue, so its card can't link anywhere">
                    <AlertTriangle className="w-3.5 h-3.5" /> No link
                  </span>
                )}
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30" title="Move up">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30" title="Move down">
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setBlocks(blocks.filter((x) => x.gift_id !== b.gift_id))}
                  className="p-1 text-gray-300 hover:text-red-600"
                  title="Remove from this article"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {editCopy && (
              <>
                <input
                  name={`heading_${b.gift_id}`}
                  defaultValue={b.heading}
                  className="w-full rounded-xl border-gray-200 text-sm text-gray-800 focus:border-accent focus:ring-accent mb-2 font-semibold"
                />
                <textarea
                  name={`blurb_${b.gift_id}`}
                  rows={3}
                  defaultValue={b.blurb}
                  className="w-full rounded-xl border-gray-200 text-sm text-gray-800 focus:border-accent focus:ring-accent"
                />
              </>
            )}
          </div>
        ))}
      </div>

      {/* Catalogue search */}
      <div className="mt-5 border-t border-dashed border-gray-200 pt-5">
        <div className="flex items-center gap-2">
          <div className="relative flex-grow">
            <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  search();
                }
              }}
              placeholder="Search your catalogue to add a gift…"
              className="w-full rounded-xl border-gray-200 pl-9 text-sm focus:border-accent focus:ring-accent"
            />
          </div>
          <button
            type="button"
            onClick={search}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:text-accent hover:border-accent/40 disabled:opacity-60 transition-colors"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
          </button>
        </div>

        {results && (
          <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto">
            {results.length === 0 && <p className="text-sm text-gray-400 py-2">No matching gifts in the catalogue.</p>}
            {results.map((r) => (
              <div key={r.gift_id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 truncate">{r.name}</p>
                  <p className="text-xs text-gray-400">
                    {r.price_min != null ? `$${r.price_min}` : "—"}
                    {r.price_max != null && r.price_max !== r.price_min ? ` – $${r.price_max}` : ""}
                    {!r.slug && " · no link"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={chosen.has(r.gift_id)}
                  onClick={() => setBlocks([...blocks, r])}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary text-white px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> {chosen.has(r.gift_id) ? "Added" : "Add"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
