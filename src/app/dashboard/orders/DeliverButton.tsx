"use client";

import { useState, useTransition } from "react";
import { deliverOrder } from "./actions";
import { Send, Loader2 } from "lucide-react";

export function DeliverButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    if (!window.confirm("Deliver this order? This emails the finished assets to the buyer.")) return;
    startTransition(async () => {
      try {
        await deliverOrder(id);
      } catch (e: any) {
        setError(e?.message || "Could not deliver");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Deliver to buyer
      </button>
      {error && <p className="text-xs text-red-600 max-w-xs text-right">{error}</p>}
    </div>
  );
}
