import { createClient } from "@/utils/supabase/server";
import { Plus, Gift as GiftIcon } from "lucide-react";
import Link from "next/link";
import { PurchaseCard } from "./components";

export default async function GiftsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch Purchases
  const { data: purchases } = await supabase
    .from("purchases")
    .select(`
      *,
      occasions(title),
      gifts(name, image_url, affiliate_url)
    `)
    .eq("user_id", user.id)
    .order("purchased_at", { ascending: false });

  const hasPurchases = purchases && purchases.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">Gift History</h1>
          <p className="text-gray-500 mt-1">Keep track of everything you&apos;ve given and things you&apos;ve saved.</p>
        </div>
        <Link 
          href="/dashboard/gifts/new" 
          className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md"
        >
          <Plus className="w-4 h-4" /> Add Past Gift
        </Link>
      </div>

      {!hasPurchases ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-12 text-center animate-in fade-in zoom-in-95">
          <GiftIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">Your gift history is empty</h2>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">
            When you find gifts using KindlyBox or buy them elsewhere, you can record them here to avoid giving the same thing twice.
          </p>
          <Link 
            href="/dashboard/gifts/new" 
            className="inline-flex items-center justify-center gap-2 bg-accent text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors shadow-md"
          >
            <Plus className="w-5 h-5" /> Record First Gift
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-4">
          {purchases.map((purchase) => (
            <PurchaseCard key={purchase.id} purchase={purchase} />
          ))}
        </div>
      )}
    </div>
  );
}
