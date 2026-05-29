import { createClient } from "@/utils/supabase/server";
import { Plus, CalendarHeart } from "lucide-react";
import Link from "next/link";
import { OccasionCard } from "./components";

export default async function OccasionsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch Occasions
  const { data: occasions, error } = await supabase
    .from("occasions")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: true });

  const hasOccasions = occasions && occasions.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">Your Occasions</h1>
          <p className="text-gray-500 mt-1">Manage birthdays, anniversaries, and special events.</p>
        </div>
        <Link 
          href="/dashboard/occasions/new" 
          className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md"
        >
          <Plus className="w-4 h-4" /> Add Occasion
        </Link>
      </div>

      {!hasOccasions ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-12 text-center animate-in fade-in zoom-in-95">
          <CalendarHeart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">No occasions yet</h2>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">
            Keep track of the important dates in your life and never miss a gifting opportunity again.
          </p>
          <Link 
            href="/dashboard/occasions/new" 
            className="inline-flex items-center justify-center gap-2 bg-accent text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors shadow-md"
          >
            <Plus className="w-5 h-5" /> Add First Occasion
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
          {occasions.map((occ) => (
            <OccasionCard key={occ.id} occasion={occ} />
          ))}
        </div>
      )}
    </div>
  );
}
