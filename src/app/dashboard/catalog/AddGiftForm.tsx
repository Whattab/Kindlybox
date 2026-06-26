"use client";

import { useRef, useState, useTransition } from "react";
import { createGift, deleteGift } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PlusCircle, Trash2, Loader2, CheckCircle2 } from "lucide-react";

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

function CheckboxGroup({ name, options }: { name: string; options: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <label
          key={opt}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 cursor-pointer hover:bg-gray-100 has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:checked]:text-accent transition-colors capitalize"
        >
          <input type="checkbox" name={name} value={opt} className="rounded border-gray-300 text-accent focus:ring-accent" />
          {opt}
        </label>
      ))}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4";
const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";

export function AddGiftForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSavedName(null);
    try {
      await createGift(formData);
      setSavedName((formData.get("name") as string) || "Gift");
      formRef.current?.reset();
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className={labelClass}>Gift Name *</label>
          <input type="text" name="name" required className={inputClass} placeholder="e.g. Stanley Quencher 40oz Tumbler" />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>Description</label>
          <textarea name="description" rows={2} className={inputClass} placeholder="One or two punchy sentences about the gift." />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>Image URL</label>
          <input type="url" name="image_url" className={inputClass} placeholder="https://..." />
        </div>

        <div>
          <label className={labelClass}>Price Min ($) *</label>
          <input type="number" name="price_min" required min="0" step="0.01" className={inputClass} placeholder="35" />
        </div>
        <div>
          <label className={labelClass}>Price Max ($) *</label>
          <input type="number" name="price_max" required min="0" step="0.01" className={inputClass} placeholder="45" />
        </div>

        <div>
          <label className={labelClass}>Amazon / Destination URL</label>
          <input type="url" name="destination_url" className={inputClass} placeholder="https://www.amazon.com/dp/..." />
          <p className="text-xs text-gray-400 mt-1">Leave blank to show a &ldquo;coming soon&rdquo; state.</p>
        </div>
        <div>
          <label className={labelClass}>Affiliate Network</label>
          <select name="affiliate_network" defaultValue="amazon" className={`${inputClass} bg-white`}>
            <option value="amazon">amazon</option>
            <option value="awin">awin</option>
            <option value="etsy">etsy</option>
            <option value="other">other</option>
          </select>
        </div>
      </div>

      <div className="pt-2">
        <label className={labelClass}>Tags / Interests</label>
        <CheckboxGroup name="tags" options={TAGS} />
      </div>
      <div>
        <label className={labelClass}>Occasions</label>
        <CheckboxGroup name="occasions" options={OCCASIONS} />
      </div>
      <div>
        <label className={labelClass}>Recipients</label>
        <CheckboxGroup name="recipients" options={RECIPIENTS} />
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</p>
      )}
      {savedName && (
        <p className="text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Added &ldquo;{savedName}&rdquo;. Form cleared — add another.
        </p>
      )}

      <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
        <SubmitButton pendingText="Adding..." className="bg-primary px-8">
          <PlusCircle className="w-4 h-4 mr-1" /> Add Gift
        </SubmitButton>
      </div>
    </form>
  );
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
