"use client";

import { useTransition } from "react";
import { Check, Archive, Loader2, RotateCcw, PenLine, Eye, Globe } from "lucide-react";
import { setOpportunityStatus } from "./actions";

// Statuses an article owns — the opportunity just reflects them.
const IN_PROGRESS: Record<string, { label: string; icon: typeof PenLine; className: string }> = {
  WRITING: { label: "Draft written", icon: PenLine, className: "text-gray-600 bg-gray-100 border-gray-200" },
  REVIEW: { label: "In review", icon: Eye, className: "text-amber-700 bg-amber-50 border-amber-200" },
  PUBLISHED: { label: "Published", icon: Globe, className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
};

export function StatusButtons({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const go = (next: string) => start(async () => { await setOpportunityStatus(id, next); });

  if (pending) {
    return <span className="inline-flex items-center text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /></span>;
  }

  if (status === "APPROVED") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
          <Check className="w-3.5 h-3.5" /> Approved
        </span>
        <button onClick={() => go("RECOMMENDED")} className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Undo
        </button>
      </div>
    );
  }

  // Once an article exists, its own status drives this row — the article
  // actions (publish, unpublish, delete) are the only way to change it.
  if (IN_PROGRESS[status]) {
    const s = IN_PROGRESS[status];
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold border rounded-full px-2.5 py-1 ${s.className}`}>
        <s.icon className="w-3.5 h-3.5" /> {s.label}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => go("APPROVED")}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700 transition-colors"
      >
        <Check className="w-3.5 h-3.5" /> Approve
      </button>
      <button
        onClick={() => go("ARCHIVED")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 text-gray-500 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors"
      >
        <Archive className="w-3.5 h-3.5" /> Dismiss
      </button>
    </div>
  );
}
