"use client";

import { useState, useTransition } from "react";
import { deleteMyOrder } from "./actions";
import { Trash2, Loader2 } from "lucide-react";

export function DeleteOrderButton({ id, label }: { id: string; label: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    setError(null);
    if (!window.confirm(`Delete this order (${label})? This removes it and any files, and can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteMyOrder(id);
      } catch (e: any) {
        setError(e?.message || "Could not delete");
      }
    });
  };

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-gray-300 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
        title="Delete order"
        aria-label="Delete order"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
