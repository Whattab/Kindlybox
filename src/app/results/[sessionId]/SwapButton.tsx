"use client";

// "Not quite — swap this one" (Step 7b): replaces just this gift; opens a new
// results page with the other two kept.

import { useFormStatus } from "react-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { swapPick } from "./actions";

function Inner() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-accent disabled:opacity-60">
      {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
      {pending ? "Finding another…" : "Not quite — swap this one"}
    </button>
  );
}

export function SwapButton({ sessionId, suggestionId }: { sessionId: string; suggestionId: string }) {
  return (
    <form action={swapPick}>
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="suggestion_id" value={suggestionId} />
      <Inner />
    </form>
  );
}
