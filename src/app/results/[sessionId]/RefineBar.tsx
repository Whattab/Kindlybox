"use client";

// "Not quite right? Show me…" — Step 7 refinement buttons. Each submits the
// refineResults server action, which opens a NEW results page (Back returns).

import { useFormStatus } from "react-dom";
import { Loader2, PiggyBank, Sparkles, Ticket, Zap } from "lucide-react";
import { refineResults } from "./actions";

const BUTTONS = [
  { kind: "cheaper", label: "Cheaper", icon: PiggyBank },
  { kind: "unique", label: "More unique", icon: Sparkles },
  { kind: "experience", label: "An experience instead", icon: Ticket },
  { kind: "last-minute", label: "Last-minute ideas", icon: Zap },
] as const;

function RefineButton({ label, icon: Icon }: { label: string; icon: typeof Zap }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-60">
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {pending ? "Finding…" : label}
    </button>
  );
}

export function RefineBar({ sessionId }: { sessionId: string }) {
  return (
    <div className="mt-8">
      <p className="text-sm font-semibold text-gray-500 mb-3">Not quite right? Show me…</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {BUTTONS.map((b) => (
          <form key={b.kind} action={refineResults}>
            <input type="hidden" name="session_id" value={sessionId} />
            <input type="hidden" name="kind" value={b.kind} />
            <RefineButton label={b.label} icon={b.icon} />
          </form>
        ))}
      </div>
    </div>
  );
}
