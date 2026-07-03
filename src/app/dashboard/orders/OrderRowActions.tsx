"use client";

import { useTransition } from "react";
import { archiveOrder, deleteOrder } from "./actions";
import { Archive, ArchiveRestore, Trash2, Loader2 } from "lucide-react";

export function OrderRowActions({
  id,
  label,
  archived,
}: {
  id: string;
  label: string;
  archived: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const toggleArchive = () => {
    startTransition(() => {
      archiveOrder(id, !archived);
    });
  };

  const handleDelete = () => {
    if (window.confirm(`Permanently delete this order (${label})? This also removes its uploaded files and cannot be undone.`)) {
      startTransition(() => {
        deleteOrder(id);
      });
    }
  };

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        onClick={toggleArchive}
        disabled={isPending}
        className="text-gray-400 hover:text-primary transition-colors p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
        title={archived ? "Unarchive" : "Archive"}
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
      </button>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
        title="Delete permanently"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
