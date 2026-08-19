"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Globe, EyeOff, Eye, RefreshCw, Trash2, PenLine, ListTree } from "lucide-react";
import { setArticleStatus, regenerateOutline, writeFullArticle, deleteArticle } from "../actions";

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

  const isOutline = status === "OUTLINE";
  const isPublished = status === "PUBLISHED";

  const btn = "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors";
  const ghost = "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 text-gray-500 px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {!isPublished && (
          <button
            onClick={() => run(() => regenerateOutline(id))}
            className={ghost}
            title="Throw away this plan and have the AI propose a new one"
          >
            <ListTree className="w-4 h-4" /> Re-plan
          </button>
        )}

        {isOutline && (
          <button onClick={() => run(() => writeFullArticle(id))} className={`${btn} bg-primary text-white hover:bg-primary/90`}>
            <PenLine className="w-4 h-4" /> Write full article
          </button>
        )}

        {!isOutline && !isPublished && (
          <>
            <button
              onClick={() => run(() => writeFullArticle(id))}
              className={ghost}
              title="Rewrite the body from the approved plan"
            >
              <RefreshCw className="w-4 h-4" /> Rewrite
            </button>
            {status === "DRAFT" && (
              <button
                onClick={() => run(() => setArticleStatus(id, "REVIEW"))}
                className={`${btn} border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}
              >
                <Eye className="w-4 h-4" /> Mark for review
              </button>
            )}
            <button
              onClick={() => run(() => setArticleStatus(id, "PUBLISHED"))}
              className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              <Globe className="w-4 h-4" /> Publish
            </button>
          </>
        )}

        {isPublished && (
          <button
            onClick={() => run(() => setArticleStatus(id, "DRAFT"))}
            className={`${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`}
            title="Take it off the public blog"
          >
            <EyeOff className="w-4 h-4" /> Unpublish
          </button>
        )}

        <button
          onClick={() => {
            if (!confirm("Delete this article? The opportunity goes back to Approved so you can plan it again later.")) return;
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
