"use client";

// Shared chrome for the dark digital-gift creation flows (song / card / bundle):
// the service tabs, back button, step counter, gradient progress bar, and the
// sticky Continue button. Each flow supplies its own step content as children.

import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export type FlowService = "song" | "card" | "bundle";

const TABS: { id: FlowService; label: string }[] = [
  { id: "song", label: "Song" },
  { id: "card", label: "Card" },
  { id: "bundle", label: "Bundle" },
];

// Cream input, dark text — matches the mockups.
export const inputClass =
  "w-full rounded-2xl bg-[#F3ECDD] text-[#2a1f18] placeholder-[#9a8b76] px-4 py-3.5 " +
  "focus:outline-none focus:ring-2 focus:ring-[#D9A93E] border-0";

export function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
        selected
          ? "bg-[#D9A93E] text-[#1a120d] font-semibold"
          : "bg-[#2e241d] text-[#e3d7c7] border border-[#4a3d33] hover:border-[#6b5a49]"
      }`}
    >
      {label}
    </button>
  );
}

export function FlowShell({
  active,
  step,
  totalSteps,
  onBack,
  onContinue,
  canContinue,
  isPending,
  continueLabel = "Continue",
  pendingLabel = "Starting checkout…",
  children,
}: {
  active: FlowService;
  step: number; // 0-indexed
  totalSteps: number;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
  isPending: boolean;
  continueLabel?: string;
  pendingLabel?: string;
  children: ReactNode;
}) {
  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2b211a] via-[#221912] to-[#150f0a] text-[#f2e9db]">
      <div className="max-w-md mx-auto px-5 pt-6 pb-32">
        {/* Service tabs */}
        <div className="flex gap-1 rounded-full bg-[#2a201a] p-1 border border-[#3d3128] mb-7">
          {TABS.map((t) =>
            t.id === active ? (
              <span key={t.id} className="flex-1 text-center rounded-full py-2.5 text-sm font-bold bg-[#D9A93E] text-[#1a120d]">
                {t.label}
              </span>
            ) : (
              <Link
                key={t.id}
                href={`/extras/${t.id}`}
                className="flex-1 text-center rounded-full py-2.5 text-sm font-semibold text-[#b6a898] hover:text-[#f2e9db]"
              >
                {t.label}
              </Link>
            )
          )}
        </div>

        {/* Back + step label */}
        <div className="flex items-center gap-4 mb-4">
          <button
            type="button"
            onClick={onBack}
            className="w-11 h-11 rounded-full border border-[#4a3d33] flex items-center justify-center text-[#e3d7c7] hover:border-[#6b5a49] transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold tracking-[0.15em] text-[#b6a898]">STEP {step + 1} OF {totalSteps}</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-[#3a2e25] overflow-hidden mb-8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#c0392b] via-[#e07b39] to-[#D9A93E] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {children}
      </div>

      {/* Sticky Continue bar */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#150f0a] via-[#150f0a] to-transparent pt-8 pb-6 px-5">
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue || isPending}
            className="w-full rounded-full bg-[#D9A93E] text-[#1a120d] font-bold py-4 inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#e5b74f] transition-colors"
          >
            {isPending ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> {pendingLabel}</>
            ) : (
              <>{continueLabel} <ChevronRight className="w-5 h-5" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
