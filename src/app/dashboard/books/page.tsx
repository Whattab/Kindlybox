import { requireAdmin } from "@/utils/admin";
import { createServiceClient } from "@/utils/supabase/admin";
import { BookOpen } from "lucide-react";
import { BookImporter } from "./BookImporter";

export const dynamic = "force-dynamic";

export default async function BooksPage() {
  await requireAdmin();
  const admin = createServiceClient();
  const { count } = await admin
    .from("gifts")
    .select("id", { count: "exact", head: true })
    .eq("active", true)
    .like("slug", "book-%");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary">Add Books</h1>
            <p className="text-gray-500 mt-0.5">Bulk-add Bookshop.org books to the gift catalogue.</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{count ?? 0}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">books in catalogue</div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-accent/15 bg-accent/5 px-4 py-3 text-sm text-gray-700 leading-relaxed">
        Paste a batch of ISBNs, tag them by recipient/occasion, and hit Import. Each book gets its title,
        author and cover pulled automatically, plus your Bookshop affiliate link — then it flows into the
        quiz and can headline a guide. Books are one operation, not one at a time.
      </div>

      <BookImporter />
    </div>
  );
}
