"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { backfillAmazonTags } from "./actions";

export function BackfillButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = () => start(async () => {
    setMsg(null);
    try {
      const r = await backfillAmazonTags();
      setMsg(`Checked ${r.checked} gifts — updated ${r.updated}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Backfill failed.");
    }
  });
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={run} disabled={pending}
        className="inline-flex items-center gap-2 rounded-full border border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/20 disabled:opacity-50">
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {pending ? "Filling tags… (about a minute)" : "Fill missing tags with AI"}
      </button>
      {msg && <span className="text-sm text-emerald-700">{msg}</span>}
    </div>
  );
}
