"use client";

import { useState, useTransition } from "react";
import { Loader2, PackagePlus, Check, AlertTriangle } from "lucide-react";
import { TAGS, RECIPIENTS, OCCASIONS } from "@/lib/gift-vocab";
import { addAmazonGift } from "./actions";

const chip = "cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm transition-colors";
const on = "bg-accent text-white border-accent";
const off = "bg-white text-gray-600 border-gray-200 hover:border-accent/40";

// Interest tags only — "gift cards" isn't a quiz interest.
const INTERESTS = TAGS.filter((t) => t !== "gift cards");

export function AmazonImporter() {
  // Per-item fields (cleared after each successful add)
  const [asin, setAsin] = useState("");
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  // Sticky fields (kept across adds so a run of similar items is fast)
  const [tags, setTags] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [gender, setGender] = useState("unisex");
  const [priceMin, setPriceMin] = useState(20);
  const [priceMax, setPriceMax] = useState(50);

  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ name: string; updated?: boolean }[]>([]);
  const [pending, start] = useTransition();

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = () =>
    start(async () => {
      setError(null);
      try {
        const r = await addAmazonGift({ asin, name, blurb, imageUrl, tags, recipients, occasions, gender, priceMin, priceMax });
        if (r.error) { setError(r.error); return; }
        setAdded((a) => [{ name: r.name || name, updated: r.updated }, ...a]);
        setAsin(""); setName(""); setBlurb(""); setImageUrl(""); // clear per-item fields; keep tags etc.
      } catch (e: any) {
        setError(e?.message || "Failed to add.");
      }
    });

  const field = "w-full rounded-xl border-gray-200 text-sm focus:border-accent focus:ring-accent";
  const label = "block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5";
  const canSubmit = asin.trim() && name.trim() && imageUrl.trim() && tags.length > 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-primary/5 border border-gray-100 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={label}>ASIN or Amazon URL</label>
            <input value={asin} onChange={(e) => setAsin(e.target.value)} placeholder="B07CSKGLMM" className={`${field} font-mono`} />
            <p className="text-xs text-gray-400 mt-1">Paste the ASIN or the full product URL.</p>
          </div>
          <div>
            <label className={label}>Image URL</label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://m.media-amazon.com/images/I/…" className={field} />
            <p className="text-xs text-gray-400 mt-1">SiteStripe → right-click photo → <b>Copy image address</b>.</p>
          </div>
        </div>

        <div>
          <label className={label}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="OXO Conical Burr Coffee Grinder" className={field} />
        </div>

        <div>
          <label className={label}>Blurb (optional)</label>
          <textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} rows={2} placeholder="One line on why it's a great gift." className={field} />
        </div>

        <div>
          <label className={label}>Interests (who it's for) — pick at least one</label>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((t) => (
              <button type="button" key={t} onClick={() => toggle(tags, setTags, t)} className={`${chip} ${tags.includes(t) ? on : off}`}>{t}</button>
            ))}
          </div>
        </div>

        <div>
          <label className={label}>Recipients (optional)</label>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={label}>Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={field}>
              <option value="unisex">Unisex</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>
          <div>
            <label className={label}>Price range (for budget matching only — never shown)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">$</span>
              <input type="number" value={priceMin} onChange={(e) => setPriceMin(Number(e.target.value))} className={`${field} w-24`} />
              <span className="text-sm text-gray-400">–</span>
              <input type="number" value={priceMax} onChange={(e) => setPriceMax(Number(e.target.value))} className={`${field} w-24`} />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 inline-flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={pending || !canSubmit}
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
            {pending ? "Adding…" : "Add gift"}
          </button>
        </div>
      </div>

      {added.length > 0 && (
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-primary/5 border border-gray-100 text-sm">
          <p className="font-semibold text-emerald-700 inline-flex items-center gap-1.5 mb-2"><Check className="w-4 h-4" /> Added this session ({added.length})</p>
          <ul className="space-y-1 text-gray-600">
            {added.map((a, i) => <li key={i}>• {a.name}{a.updated ? <span className="text-gray-400"> (updated)</span> : null}</li>)}
          </ul>
          <p className="text-xs text-gray-400 mt-3">Tags, recipients, occasions and price stay selected so you can add similar items quickly.</p>
        </div>
      )}
    </div>
  );
}
