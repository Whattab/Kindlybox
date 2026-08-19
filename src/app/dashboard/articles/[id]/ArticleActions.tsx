"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Globe, EyeOff, Eye, RefreshCw, Trash2 } from "lucide-react";
import { setArticleStatus, regenerateArticle, deleteArticle } from "../actions";

export function ArticleActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = (fn: () => Promise<unknown>, after?: () => void) =>
    start(async () => {
      setError(null);
      try {
        await fn();
        after?.();
      } catch (e: any) {
        setError(e?.message || "Something went wrong");
      }
    });

  if (pending) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Working…
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {status !== "PUBLISHED" && (
          <>
            <button
              onClick={() => run(() => regenerateArticle(id))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 text-gray-500 px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
              title="Rewrite this draft from its opportunity"
            >
              <RefreshCw className="w-4 h-4" /> Rewrite
            </button>
            {status === "DRAFT" && (
              <button
                onClick={() => run(() => setArticleStatus(id, "REVIEW"))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 px-3 py-2 text-sm font-semibold hover:bg-amber-100 transition-colors"
              >
                <Eye className="w-4 h-4" /> Mark for review
              </button>
            )}
            <button
              onClick={() => run(() => setArticleStatus(id, "PUBLISHED"))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3.5 py-2 text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              <Globe className="w-4 h-4" /> Publish
            </button>
          </>
        )}

        {status === "PUBLISHED" && (
          <button
            onClick={() => run(() => setArticleStatus(id, "DRAFT"))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 text-gray-600 px-3.5 py-2 text-sm font-semibold hover:bg-gray-50 transition-colors"
            title="Take it off the public blog"
          >
            <EyeOff className="w-4 h-4" /> Unpublish
          </button>
        )}

        <button
          onClick={() => {
            if (!confirm("Delete this article? The opportunity goes back to Approved so you can rewrite it later.")) return;
            run(() => deleteArticle(id), () => router.push("/dashboard/articles"));
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 text-gray-400 px-3 py-2 text-sm font-medium hover:text-red-600 hover:border-red-200 transition-colors"
          title="Delete article"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {error && <p className="text-xs text-red-600 max-w-sm text-right">{error}</p>}
    </div>
  );
}
