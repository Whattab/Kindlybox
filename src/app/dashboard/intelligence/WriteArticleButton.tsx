"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine, Loader2 } from "lucide-react";
import { writeArticleFromOpportunity } from "../articles/actions";

// Turns an approved opportunity into a draft article, then drops you straight
// into the editor. Safe to click twice — the action returns the existing draft
// rather than writing a second one.
export function WriteArticleButton({ opportunityId }: { opportunityId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const write = () =>
    start(async () => {
      setError(null);
      try {
        const id = await writeArticleFromOpportunity(opportunityId);
        router.push(`/dashboard/articles/${id}`);
      } catch (e: any) {
        setError(e?.message || "Could not draft this article");
      }
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={write}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
        {pending ? "Writing…" : "Write article"}
      </button>
      {error && <p className="text-[11px] text-red-600 max-w-[240px] text-right">{error}</p>}
    </div>
  );
}
