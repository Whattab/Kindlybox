"use client";

import { useState, useTransition } from "react";
import { Loader2, BookPlus, Check, X, AlertTriangle } from "lucide-react";
import { RECIPIENTS, OCCASIONS } from "@/lib/gift-vocab";
import { addBooks, type AddBooksResult } from "./actions";

const chip =
  "cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm transition-colors";
const on = "bg-accent text-white border-accent";
const off = "bg-white text-gray-600 border-gray-200 hover:border-accent/40";

export function BookImporter() {
  const [isbns, setIsbns] = useState("");
  const [topics, setTopics] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [gender, setGender] = useState("unisex");
  const [priceMin, setPriceMin] = useState(15);
  const [priceMax, setPriceMax] = useState(30);
  const [result, setResult] = useState<AddBooksResult | null>(null);
  const [pending, start] = useTransition();

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const count = isbns.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean).length;

  const submit = () =>
    start(async () => {
      setResult(null);
      try {
        const r = await addBooks({ isbns, topics, recipients, occasions, gender, priceMin, priceMax });
        setResult(r);
        if (r.added.length) setIsbns(""); // clear the box after a successful batch
      } catch (e: any) {
        setResult({ added: [], skipped: [], failed: [{ isbn: "—", reason: e?.message || "failed" }] });
      }
    });

  const field = "w-full rounded-xl border-gray-200 text-sm focus:border-accent focus:ring-accent";
  const label = "block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-primary/5 border border-gray-100 space-y-5">
        <div>
          <label className={label}>ISBNs — one per line (or spaces/commas)</label>
          <textarea
            value={isbns}
            onChange={(e) => setIsbns(e.target.value)}
            rows={7}
            placeholder={"9780593978177\n9780525559474\n9780385547345"}
            className={`${field} font-mono text-[13px] leading-relaxed`}
          />
          <p className="text-xs text-gray-400 mt-1">{count} ISBN{count === 1 ? "" : "s"} · grab them from each Bookshop URL (the <code className="bg-gray-100 px-1 rounded">ean=</code> part).</p>
        </div>

        <div>
          <label className={label}>Recipients (who it's for)</label>
          <div className="flex flex-wrap gap-2">
            {RECIPIENTS.map((r) => (
              <button type="button" key={r} onClick={() => toggle(recipients, setRecipients, r)} className={`${chip} ${recipients.includes(r) ? on : off}`}>{r}</button>
            ))}
          </div>
        </div>

        <div>
          <label className={label}>Occasions (optional)</label>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <button type="button" key={o} onClick={() => toggle(occasions, setOccasions, o)} className={`${chip} ${occasions.includes(o) ? on : off}`}>{o}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className={label}>Topic tags (optional)</label>
            <input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="cooking, food" className={field} />
            <p className="text-xs text-gray-400 mt-1">Extra tags for guide grouping. &quot;books &amp; reading&quot; is always added.</p>
          </div>
          <div>
            <label className={label}>Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={field}>
              <option value="unisex">Unisex</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>
          <div>
            <label className={label}>Price range (fallback)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">$</span>
              <input type="number" value={priceMin} onChange={(e) => setPriceMin(Number(e.target.value))} className={`${field} w-20`} />
              <span className="text-sm text-gray-400">–</span>
              <input type="number" value={priceMax} onChange={(e) => setPriceMax(Number(e.target.value))} className={`${field} w-20`} />
            </div>
            <p className="text-xs text-gray-400 mt-1">Used when a book has no price.</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={pending || count === 0}
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookPlus className="w-4 h-4" />}
            {pending ? "Importing…" : `Import ${count || ""} book${count === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-primary/5 border border-gray-100 space-y-4 text-sm">
          {result.added.length > 0 && (
            <div>
              <p className="font-semibold text-emerald-700 inline-flex items-center gap-1.5 mb-2"><Check className="w-4 h-4" /> Added {result.added.length}</p>
              <ul className="space-y-1 text-gray-600">{result.added.map((b) => <li key={b.isbn}>• {b.title} <span className="text-gray-400">({b.isbn})</span></li>)}</ul>
            </div>
          )}
          {result.skipped.length > 0 && (
            <div>
              <p className="font-semibold text-gray-500 inline-flex items-center gap-1.5 mb-2"><X className="w-4 h-4" /> Already in catalogue {result.skipped.length}</p>
              <ul className="space-y-1 text-gray-500">{result.skipped.map((b) => <li key={b.isbn}>• {b.title}</li>)}</ul>
            </div>
          )}
          {result.failed.length > 0 && (
            <div>
              <p className="font-semibold text-amber-700 inline-flex items-center gap-1.5 mb-2"><AlertTriangle className="w-4 h-4" /> Couldn&apos;t add {result.failed.length}</p>
              <ul className="space-y-1 text-amber-700">{result.failed.map((b, i) => <li key={i}>• {b.isbn} — {b.reason}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
