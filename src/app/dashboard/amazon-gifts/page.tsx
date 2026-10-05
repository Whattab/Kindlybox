import { requireAdmin } from "@/utils/admin";
import { createServiceClient } from "@/utils/supabase/admin";
import { ShoppingCart } from "lucide-react";
import { AmazonImporter } from "./AmazonImporter";

export const dynamic = "force-dynamic";

export default async function AmazonGiftsPage() {
  await requireAdmin();
  const admin = createServiceClient();
  const { count } = await admin
    .from("gifts")
    .select("id", { count: "exact", head: true })
    .eq("active", true)
    .eq("affiliate_network", "amazon");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <ShoppingCart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary">Add Amazon Gifts</h1>
            <p className="text-gray-500 mt-0.5">Add Amazon products to the gift catalogue, one at a time.</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{count ?? 0}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">amazon gifts</div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-accent/15 bg-accent/5 px-4 py-3 text-sm text-gray-700 leading-relaxed">
        Paste the <b>ASIN</b> (or product URL) and a <b>SiteStripe image URL</b>, name it, and tag it by interest/recipient —
        it flows straight into the quiz. Amazon has no price API yet, so the price you set is used only for budget
        matching and is never shown (the card displays &quot;See price on Amazon&quot;).
      </div>

      <AmazonImporter />
    </div>
  );
}
