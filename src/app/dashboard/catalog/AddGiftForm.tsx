"use client";

import { useRef, useState, useTransition } from "react";
import { createGift, updateGift, deleteGift } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PlusCircle, Save, Trash2, Loader2, CheckCircle2, Image as ImageIcon } from "lucide-react";

// ── Canonical quiz vocabulary — MUST stay in sync with src/components/quiz/QuizFlow.tsx.
// Picking from checkboxes (instead of typing) makes a vocabulary typo impossible.
const TAGS = [
  "tech & gadgets", "fashion & accessories", "books & reading", "home & kitchen",
  "fitness & wellness", "outdoor/ adventure", "art & crafts", "music & instruments",
  "gaming", "gardening", "movies & tv", "travel", "pets", "home decor",
];
const OCCASIONS = [
  "birthday", "anniversary", "graduation", "baby shower", "wedding",
  "valentine's day", "promotion/retirement", "house warming", "mother's day", "father's day",
];
const RECIPIENTS = [
  "him", "her", "parent", "child", "sibling", "co-worker", "teacher/mentor", "friend",
];

export type GiftFormInitial = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_min: number | string | null;
  price_max: number | string | null;
  destination_url: string | null;
  affiliate_network: string | null;
  active?: boolean | null;
  tags: string[] | null;
  occasions: string[] | null;
  recipients: string[] | null;
  slug?: string;
  affiliate_url?: string;
};

function CheckboxGroup({ name, options, selected }: { name: string; options: string[]; selected: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <label
          key={opt}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 cursor-pointer hover:bg-gray-100 has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:checked]:text-accent transition-colors capitalize"
        >
          <input
            type="checkbox"
            name={name}
            value={opt}
            defaultChecked={selected.includes(opt)}
            className="rounded border-gray-300 text-accent focus:ring-accent"
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4";
const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";

// One form, two modes: "create" (clears + lets you add another) and
// "edit" (pre-filled from `initial`, saves in place).
export function GiftForm({ mode, initial }: { mode: "create" | "edit"; initial?: GiftFormInitial }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [imgError, setImgError] = useState(false);
  const isEdit = mode === "edit";

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSavedName(null);
    try {
      if (isEdit && initial) {
        await updateGift(initial.id, formData);
      } else {
        await createGift(formData);
      }
      setSavedName((formData.get("name") as string) || "Gift");
      if (!isEdit) {
        formRef.current?.reset();
        setImageUrl(""); // controlled input isn't cleared by form.reset()
        setImgError(false);
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className={labelClass}>Gift Name *</label>
          <input type="text" name="name" required defaultValue={initial?.name} className={inputClass} placeholder="e.g. Stanley Quencher 40oz Tumbler" />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>Description</label>
          <textarea name="description" rows={2} defaultValue={initial?.description ?? ""} className={inputClass} placeholder="One or two punchy sentences about the gift." />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>Image URL</label>
          <div className="flex gap-4 items-start">
            {/* Live preview catches non-image URLs (e.g. a product page) instantly. */}
            <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex-shrink-0 overflow-hidden flex items-center justify-center">
              {imageUrl && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="preview" className="w-full h-full object-cover" onError={() => setImgError(true)} />
              ) : (
                <ImageIcon className="w-6 h-6 text-gray-300" />
              )}
            </div>
            <div className="flex-1">
              <input
                type="url"
                name="image_url"
                value={imageUrl}
                onChange={(e) => { setImageUrl(e.target.value); setImgError(false); }}
                className={inputClass}
                placeholder="https://...jpg (a direct image link, NOT a product page)"
              />
              {imageUrl && imgError ? (
                <p className="text-xs text-red-500 mt-1">That URL didn&apos;t load as an image — make sure it&apos;s a direct image link, not a product page.</p>
              ) : (
                <p className="text-xs text-gray-400 mt-1">Use a direct image link. On Amazon: right-click the photo &rarr; &ldquo;Copy image address&rdquo;.</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className={labelClass}>Price Min ($) *</label>
          <input type="number" name="price_min" required min="0" step="0.01" defaultValue={initial?.price_min ?? ""} className={inputClass} placeholder="35" />
        </div>
        <div>
          <label className={labelClass}>Price Max ($) *</label>
          <input type="number" name="price_max" required min="0" step="0.01" defaultValue={initial?.price_max ?? ""} className={inputClass} placeholder="45" />
        </div>

        <div>
          <label className={labelClass}>Amazon / Destination URL</label>
          <input type="url" name="destination_url" defaultValue={initial?.destination_url ?? ""} className={inputClass} placeholder="https://www.amazon.com/dp/..." />
          <p className="text-xs text-gray-400 mt-1">Leave blank to show a &ldquo;coming soon&rdquo; state.</p>
        </div>
        <div>
          <label className={labelClass}>Affiliate Network</label>
          <select name="affiliate_network" defaultValue={initial?.affiliate_network ?? "amazon"} className={`${inputClass} bg-white`}>
            <option value="amazon">amazon</option>
            <option value="awin">awin</option>
            <option value="etsy">etsy</option>
            <option value="other">other</option>
          </select>
        </div>
      </div>

      <div className="pt-2">
        <label className={labelClass}>Tags / Interests</label>
        <CheckboxGroup name="tags" options={TAGS} selected={initial?.tags ?? []} />
      </div>
      <div>
        <label className={labelClass}>Occasions</label>
        <CheckboxGroup name="occasions" options={OCCASIONS} selected={initial?.occasions ?? []} />
      </div>
      <div>
        <label className={labelClass}>Recipients</label>
        <CheckboxGroup name="recipients" options={RECIPIENTS} selected={initial?.recipients ?? []} />
      </div>

      {/* Live toggle — unchecked hides the gift from quiz recommendations without deleting it. */}
      <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 cursor-pointer has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50">
        <input
          type="checkbox"
          name="active"
          defaultChecked={initial?.active ?? true}
          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-5 h-5"
        />
        <span>
          <span className="block text-sm font-semibold text-gray-800">Live</span>
          <span className="block text-xs text-gray-500">When on, this gift can appear in quiz recommendations. Turn off to pause it without deleting.</span>
        </span>
      </label>

      {error && (
        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</p>
      )}
      {savedName && (
        <p className="text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {isEdit ? `Saved changes to “${savedName}”.` : `Added “${savedName}”. Form cleared — add another.`}
        </p>
      )}

      <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
        <SubmitButton pendingText={isEdit ? "Saving..." : "Adding..."} className="bg-primary px-8">
          {isEdit ? <><Save className="w-4 h-4 mr-1" /> Save Changes</> : <><PlusCircle className="w-4 h-4 mr-1" /> Add Gift</>}
        </SubmitButton>
      </div>
    </form>
  );
}

// Backwards-compatible alias used by the catalogue page's "add" card.
export function AddGiftForm() {
  return <GiftForm mode="create" />;
}

export function DeleteGiftButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (window.confirm(`Remove "${name}" from the catalogue? This also clears any quiz results that referenced it.`)) {
      startTransition(() => {
        deleteGift(id);
      });
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-gray-400 hover:text-red-500 transition-colors p-2 bg-gray-50 hover:bg-red-50 rounded-lg disabled:opacity-50"
      title="Delete gift"
    >
      {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  );
}
