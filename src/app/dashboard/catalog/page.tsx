import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/admin";
import { AddGiftForm, DeleteGiftButton } from "./AddGiftForm";
import { Boxes, ExternalLink, Pencil } from "lucide-react";

export const dynamic = "force-dynamic"; // always reflect the latest catalogue

export default async function CatalogPage() {
  await requireAdmin(); // non-admins are redirected away
  const supabase = createClient();
  const { data: gifts } = await supabase
    .from("gifts")
    .select("id, name, price_min, price_max, slug, destination_url, active, created_at")
    .order("created_at", { ascending: false });

  const count = gifts?.length ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
          <Boxes className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">Gift Catalogue</h1>
          <p className="text-gray-500 mt-0.5">
            Add gifts the quiz can recommend. {count} {count === 1 ? "gift" : "gifts"} live.
          </p>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-3xl p-8 shadow-xl shadow-primary/5 border border-gray-100 mb-10">
        <h2 className="text-xl font-serif font-bold text-primary mb-6">Add a new gift</h2>
        <AddGiftForm />
      </div>

      {/* Existing catalogue */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">Current catalogue</h2>
      <div className="space-y-2">
        {gifts?.map((gift) => (
          <div
            key={gift.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between gap-4"
          >
            <Link href={`/dashboard/catalog/${gift.id}`} className="min-w-0 flex-1 group">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900 truncate group-hover:text-accent transition-colors">{gift.name}</p>
                {!gift.active && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-600 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 flex-shrink-0">
                    Paused
                  </span>
                )}
                {gift.active && !gift.destination_url && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 flex-shrink-0">
                    Coming soon
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 truncate">
                ${gift.price_min}–${gift.price_max} · {gift.slug}
              </p>
            </Link>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href={`/dashboard/catalog/${gift.id}`}
                className="text-gray-400 hover:text-accent transition-colors p-2 bg-gray-50 hover:bg-accent/10 rounded-lg"
                title="View / edit"
              >
                <Pencil className="w-4 h-4" />
              </Link>
              {gift.destination_url && (
                <a
                  href={gift.destination_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-accent transition-colors p-2 bg-gray-50 hover:bg-accent/10 rounded-lg"
                  title="View destination"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <DeleteGiftButton id={gift.id} name={gift.name} />
            </div>
          </div>
        ))}
        {count === 0 && (
          <p className="text-gray-400 text-sm py-8 text-center">No gifts yet — add your first one above.</p>
        )}
      </div>
    </div>
  );
}
