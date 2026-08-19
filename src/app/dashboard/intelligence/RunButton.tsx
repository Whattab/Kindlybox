"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { runEngine } from "./actions";

export function RunButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const run = () =>
    start(async () => {
      setMsg(null);
      try {
        const s = await runEngine();
        setMsg(`Done — ${s.opportunities_new} new, ${s.opportunities_updated} updated, ${s.trends_stored} trend sources refreshed.`);
      } catch (e: any) {
        setMsg(e?.message || "Run failed");
      }
    });

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {pending ? "Scanning sources…" : "Run engine now"}
      </button>
      {msg && <p className="text-xs text-gray-500 max-w-xs text-right">{msg}</p>}
    </div>
  );
}
