"use client";

import { useTransition } from "react";
import { deleteLead } from "./actions";
import { Trash2, Loader2 } from "lucide-react";

export function DeleteLeadButton({ id, email }: { id: string; email: string | null }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (window.confirm(`Delete the lead${email ? ` for ${email}` : ""}? This removes the quiz entry and its suggestions.`)) {
      startTransition(() => {
        deleteLead(id);
      });
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
      title="Delete lead"
    >
      {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  );
}
