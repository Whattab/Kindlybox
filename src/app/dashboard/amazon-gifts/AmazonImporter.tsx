"use client";

// Add Amazon gifts, shaped like the new quiz: one paste (ASIN / URL /
// SiteStripe image snippet), "Suggest with AI" to pre-fill, then review chips.
// Chip choices stay selected between adds so a run of similar items is fast.

import { useMemo, useState, useTransition } from "react";
import { Loader2, PackagePlus, Check, AlertTriangle, Sparkles } from "lucide-react";
import { amazonShortLink, parseAmazonPaste } from "@/lib/affiliate/amazon-paste";
import type { ImporterVocab } from "@/lib/amazon-assist";
import { addAmazonGift, resolveAmazonLink, suggestAmazonTags } from "./actions";

const chip = "cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm transition-colors";
const on = "bg-accent text-white border-accent";
const off = "bg-white text-gray-600 border-gray-200 hover:border-accent/40";
const subOn = "bg-accent/15 text-accent border-accent";
const subOff = "bg-gray-50 text-gray-500 border-gray-200 hover:border-accent/40";

// Quiz-facing names for the style tags (the quiz's "gift feel" question).
const STYLE_LABEL: Record<string, string> = { luxe: "treat / luxe", "fun & quirky": "fun & quirky" };

export interface ImporterPreset { interests?: string[]; occasions?: string[]; recipients?: string[]; giftType?: string[] }

export function AmazonImporter({ vocab, preset }: { vocab: ImporterVocab; preset?: ImporterPreset }) {
  // Per-item fields (cleared after each successful add)
  const [paste, setPaste] = useState("");
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  // Sticky fields (kept across adds)
  const [tags, setTags] = useState<string[]>(preset?.interests || []);
  const [recipients, setRecipients] = useState<string[]>(preset?.recipients || []);
  const [occasions, setOccasions] = useState<string[]>(preset?.occasions || []);
  const [style, setStyle] = useState<string[]>([]);
  const [giftType, setGiftType] = useState<string[]>(preset?.giftType || []);
  const [avoidFlags, setAvoidFlags] = useState<string[]>([]);
  const [gender, setGender] = useState("unisex");
  const [priceMin, setPriceMin] = useState(20);
  const [priceMax, setPriceMax] = useState(50);

  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [added, setAdded] = useState<{ name: string; updated?: boolean }[]>([]);
  const [pending, start] = useTransition();
  const [suggesting, startSuggest] = useTransition();

  const parsed = useMemo(() => parseAmazonPaste(paste), [paste]);
  const [resolving, setResolving] = useState(false);
  const onPaste = (v: string) => {
    setPaste(v);
    const p = parseAmazonPaste(v);
    if (p.imageUrl) setImageUrl(p.imageUrl); // SiteStripe snippet → official image link
    // Short links (link.amazon, amzn.to, a.co) carry no ASIN — the server opens them.
    const short = !p.asin && amazonShortLink(v);
    if (short) {
      setResolving(true);
      setError(null);
      resolveAmazonLink(short)
        .then((r) => { if ("asin" in r) setPaste(r.asin); else setError(r.error); })
        .catch(() => setError("Couldn't open that Amazon short link. Paste the ASIN instead."))
        .finally(() => setResolving(false));
    }
  };

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const suggest = () =>
    startSuggest(async () => {
      setError(null); setNote(null);
      const r = await suggestAmazonTags(name, blurb);
      if ("error" in r) { setError(r.error); return; }
      const t = r.tags;
      if (t.interests.length) setTags(t.interests);
      setOccasions(t.occasions); setRecipients(t.recipients);
      setStyle(t.style); setGiftType(t.gift_type); setAvoidFlags(t.avoid_flags);
      setGender(r.gender);
      if (r.blurb && !blurb.trim()) setBlurb(r.blurb);
      setNote(t.interests.length ? "AI suggestions filled in — check them before adding." : "AI couldn't suggest interests — pick them by hand.");
    });

  const submit = () =>
    start(async () => {
      setError(null); setNote(null);
      try {
        const r = await addAmazonGift({
          asin: parsed.asin || paste, name, blurb, imageUrl, tags, recipients, occasions,
          style, giftType, avoidFlags, gender, priceMin, priceMax,
        });
        if (r.error) { setError(r.error); return; }
        setAdded((a) => [{ name: r.name || name, updated: r.updated }, ...a]);
        setPaste(""); setName(""); setBlurb(""); setImageUrl(""); // clear per-item fields; keep chips
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add.");
      }
    });

  const field = "w-full rounded-xl border-gray-200 text-sm focus:border-accent focus:ring-accent";
  const label = "block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5";
  const canSubmit = !!parsed.asin && name.trim() && imageUrl.trim() && tags.length > 0;

  const Chips = ({ title, hint, values, list, set, labelOf }: {
    title: string; hint?: string; values: string[]; list: string[]; set: (v: string[]) => void; labelOf?: (v: string) => string;
  }) => (
    <div>
      <label className={label}>{title}{hint && <span className="normal-case font-normal text-gray-400"> — {hint}</span>}</label>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <button type="button" key={v} onClick={() => toggle(list, set, v)} className={`${chip} ${list.includes(v) ? on : off}`}>{labelOf ? labelOf(v) : v}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-primary/5 border border-gray-100 space-y-5">
        <div>
          <label className={label}>Paste: ASIN, Amazon URL, short link, or SiteStripe image snippet</label>
          <textarea value={paste} onChange={(e) => onPaste(e.target.value)} rows={2}
            placeholder={'B07CSKGLMM  ·  https://www.amazon.com/dp/B07CSKGLMM  ·  <a href="…"><img src="//ws-na.amazon-adsystem.com/…"></a>'}
            className={`${field} font-mono text-xs`} />
          <p className="text-xs mt-1 text-gray-400">
            {resolving
              ? <span className="text-gray-600">Opening Amazon short link…</span>
              : parsed.asin
              ? <span className="text-emerald-700">ASIN {parsed.asin}{parsed.imageUrl ? " · SiteStripe image found" : ""}</span>
              : <>Tip: SiteStripe → <b>Image</b> → copy the HTML, and the image fills in too. Short links (link.amazon, amzn.to) work too.</>}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-start">
          <div>
            <label className={label}>Image URL</label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Filled from the SiteStripe snippet, or paste an image address" className={field} />
          </div>
          {imageUrl && /^https:\/\//.test(imageUrl) && (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary remote image
            <img src={imageUrl} alt="" className="w-20 h-20 rounded-xl object-contain border border-gray-100 bg-gray-50" />
          )}
        </div>

        <div>
          <label className={label}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="OXO Conical Burr Coffee Grinder" className={field} />
        </div>

        <div>
          <label className={label}>Blurb <span className="normal-case font-normal text-gray-400">— shoppers&apos; words help the quiz&apos;s free-text box find it</span></label>
          <textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} rows={2} placeholder="A burr grinder for the espresso and pour-over lover who wants café-quality coffee at home." className={field} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={suggest} disabled={suggesting || !name.trim()}
            className="inline-flex items-center gap-2 rounded-full border border-accent bg-accent/10 px-5 py-2 text-sm font-semibold text-accent hover:bg-accent/20 disabled:opacity-50">
            {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {suggesting ? "Thinking…" : "Suggest with AI"}
          </button>
          <span className="text-xs text-gray-400">Fills the chips below (and the blurb if empty) from the name. You can change anything.</span>
        </div>
        {note && <p className="text-sm text-emerald-700">{note}</p>}

        <div>
          <label className={label}>Interests — pick at least one <span className="normal-case font-normal text-gray-400">(sub-hobbies power the quiz&apos;s &ldquo;Tell us a little more&rdquo;)</span></label>
          <div className="space-y-2.5">
            {vocab.interests.map((group) => (
              <div key={group.label} className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={() => toggle(tags, setTags, group.label)} className={`${chip} ${tags.includes(group.label) ? on : off}`}>{group.label}</button>
                {group.children.map((c) => (
                  <button type="button" key={c} onClick={() => toggle(tags, setTags, c)} className={`${chip} text-xs py-1 ${tags.includes(c) ? subOn : subOff}`}>{c}</button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <Chips title="Occasions" values={vocab.occasions} list={occasions} set={setOccasions} />
        <Chips title="Recipients" values={vocab.recipients} list={recipients} set={setRecipients} />
        <Chips title="Gift feel" hint='the quiz asks “What kind of gift feels right?”' values={vocab.styles} list={style} set={setStyle} labelOf={(v) => STYLE_LABEL[v] || v} />
        <Chips title="Gift type" hint="digital/experience = last-minute ideas" values={vocab.giftTypes} list={giftType} set={setGiftType} />
        <Chips title="Avoid for" hint="who should NOT get this (e.g. contains alcohol)" values={vocab.avoidFlags} list={avoidFlags} set={setAvoidFlags} />

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
          <button type="button" onClick={submit} disabled={pending || !canSubmit}
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
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
          <p className="text-xs text-gray-400 mt-3">Chips and price stay selected so you can add similar items quickly.</p>
        </div>
      )}
    </div>
  );
}
