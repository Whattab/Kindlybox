"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createGroup } from "../actions";

export const inputClass =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export function CreateGroupForm({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [f, setF] = useState({ organiserName: "", note: "", venmo: "", paypal: "", cashapp: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createGroup({ sessionId, ...f });
      // The organiser cookie is set by now — keep the secret key out of the address
      // bar so copying the URL to friends can't hand over the organiser controls.
      if (res.ok && res.id) return router.push(`/together/${res.id}?new=1`);
      setError(res.ok ? "Something went wrong." : res.error);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div>
        <label className="block text-sm font-semibold text-primary mb-1">Your name</label>
        <input value={f.organiserName} onChange={set("organiserName")} maxLength={40} required className={inputClass} placeholder="e.g. Jess" autoComplete="given-name" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-primary mb-1">Message to the group <span className="font-normal text-gray-400">(optional)</span></label>
        <textarea value={f.note} onChange={set("note")} maxLength={280} rows={2} className={inputClass} placeholder="Let's get Mom something great this year!" />
      </div>
      <div>
        <p className="text-sm font-semibold text-primary">How friends pay you back</p>
        <p className="text-xs text-gray-500 mb-2">Add at least one. Friends will see these on the group page.</p>
        <div className="space-y-2">
          <input value={f.venmo} onChange={set("venmo")} maxLength={60} className={inputClass} placeholder="Venmo username, e.g. @jess-smith" />
          <input value={f.paypal} onChange={set("paypal")} maxLength={60} className={inputClass} placeholder="PayPal email or PayPal.me name" />
          <input value={f.cashapp} onChange={set("cashapp")} maxLength={60} className={inputClass} placeholder="Cash App $cashtag, e.g. $jess" />
        </div>
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button type="submit" disabled={busy}
        className="w-full bg-accent text-white px-6 py-3 rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 shadow-md flex items-center justify-center gap-2">
        {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Creating…</> : "Create the group page"}
      </button>
    </form>
  );
}
