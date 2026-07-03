import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Gift, Calendar, DollarSign, Plus, ArrowRight,
  ExternalLink, Clock, CheckCircle2, Sparkles, Music
} from "lucide-react";
import Image from "next/image";
import { Suspense } from "react";

import { redirectToQuiz } from "./actions";

// 1. Loading Skeletons
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-200" />
            <div className="space-y-2">
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="h-6 w-12 bg-gray-300 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OccasionsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gray-200" />
            <div className="space-y-2">
              <div className="h-5 w-32 bg-gray-200 rounded" />
              <div className="h-4 w-24 bg-gray-100 rounded" />
            </div>
          </div>
          <div className="h-10 w-28 bg-gray-200 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

// 2. Data Fetching Components
async function DashboardStats({ userId }: { userId: string }) {
  const supabase = createClient();
  
  // Fetch Purchases (Total Gifts & Average Spend)
  const { data: purchases } = await supabase
    .from("purchases")
    .select("price_paid")
    .eq("user_id", userId);

  const totalGifts = purchases?.length || 0;
  const totalSpend = purchases?.reduce((sum, p) => sum + Number(p.price_paid || 0), 0) || 0;
  const avgSpend = totalGifts > 0 ? Math.round(totalSpend / totalGifts) : 0;

  // Fetch Upcoming Events Count
  const today = new Date().toISOString();
  const { count: eventsCount } = await supabase
    .from("occasions")
    .select("*", { count: 'exact', head: true })
    .eq("user_id", userId)
    .gte("date", today);

  const stats = [
    { title: "Gifts Given", value: totalGifts, icon: Gift, color: "text-accent", bg: "bg-accent/10" },
    { title: "Upcoming Events", value: eventsCount || 0, icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Avg. Spend", value: `$${avgSpend}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      {stats.map((stat, i) => (
        <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-1">
          <div className={`w-14 h-14 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
            <stat.icon className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">{stat.title}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

async function UpcomingOccasions({ userId }: { userId: string }) {
  const supabase = createClient();
  const todayDate = new Date();
  const today = todayDate.toISOString().split('T')[0];

  const { data: occasions } = await supabase
    .from("occasions")
    .select("*")
    .eq("user_id", userId)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(4);

  if (!occasions || occasions.length === 0) {
    return (
      <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
        <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No upcoming occasions</h3>
        <p className="text-sm text-gray-500 mb-4">Add birthdays, anniversaries, and more.</p>
        <Link href="/dashboard/occasions/new" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
          <Plus className="w-4 h-4" /> Add Occasion
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {occasions.map((occ) => {
        // Calculate urgency
        const eventDate = new Date(occ.date);
        const diffTime = Math.abs(eventDate.getTime() - todayDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let urgencyColor = "border-gray-200 bg-gray-50 text-gray-700";
        if (diffDays <= 7) urgencyColor = "border-red-200 bg-red-50 text-red-700";
        else if (diffDays <= 30) urgencyColor = "border-amber-200 bg-amber-50 text-amber-700";
        else urgencyColor = "border-emerald-200 bg-emerald-50 text-emerald-700";

        // Map relation/occasion to quiz values
        const recipientValue = occ.recipient_relation ? occ.recipient_relation.toLowerCase() : "";
        const occasionValue = occ.occasion_type ? occ.occasion_type.toLowerCase() : "";
        
        // Very basic budget mapping logic based on stored budget
        let budgetValue = "";
        if (occ.budget) {
          if (occ.budget < 25) budgetValue = "under-25";
          else if (occ.budget <= 50) budgetValue = "25-50";
          else if (occ.budget <= 100) budgetValue = "50-100";
          else if (occ.budget <= 200) budgetValue = "100-200";
          else budgetValue = "no-limit";
        }

        return (
          <div key={occ.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-transform hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl border ${urgencyColor}`}>
                <span className="text-xs font-bold uppercase">{eventDate.toLocaleString('default', { month: 'short' })}</span>
                <span className="text-xl font-bold leading-none">{eventDate.getDate()}</span>
              </div>
              <div>
                <h4 className="font-bold text-gray-900">{occ.title}</h4>
                <p className="text-sm text-gray-500 capitalize">{occ.recipient_name} • {diffDays === 0 ? 'Today' : `In ${diffDays} days`}</p>
              </div>
            </div>
            
            <form action={redirectToQuiz} className="sm:ml-auto">
              <input type="hidden" name="recipient" value={recipientValue} />
              <input type="hidden" name="occasion" value={occasionValue} />
              <input type="hidden" name="budget" value={budgetValue} />
              <button type="submit" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary/5 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                Find Gift <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        );
      })}
    </div>
  );
}

async function RecentPurchases({ userId }: { userId: string }) {
  const supabase = createClient();

  const { data: purchases } = await supabase
    .from("purchases")
    .select(`
      id, 
      purchased_at, 
      status, 
      price_paid, 
      gift_name, 
      recipient_name,
      gifts (name, image_url)
    `)
    .eq("user_id", userId)
    .order("purchased_at", { ascending: false })
    .limit(3);

  if (!purchases || purchases.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-gray-500 mb-2">No gifts recorded yet.</p>
        <Link href="/dashboard/gifts" className="text-sm font-semibold text-accent hover:underline">
          Log a purchase manually
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {purchases.map((purchase) => {
        const giftData = (Array.isArray(purchase.gifts) ? purchase.gifts[0] : purchase.gifts) as any;
        const giftName = giftData?.name || purchase.gift_name || "Unknown Gift";
        const imageUrl = giftData?.image_url || "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400&h=400&fit=crop";
        
        return (
          <div key={purchase.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm group">
            <div className="relative h-40 w-full bg-gray-100">
              <Image src={imageUrl} alt={giftName} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
              {purchase.status === 'delivered' ? (
                 <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                   <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                   <span className="text-xs font-bold text-gray-700">Delivered</span>
                 </div>
              ) : (
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                   <Clock className="w-3.5 h-3.5 text-amber-500" />
                   <span className="text-xs font-bold text-gray-700 capitalize">{purchase.status}</span>
                 </div>
              )}
            </div>
            <div className="p-4">
              <h4 className="font-bold text-gray-900 mb-1 line-clamp-1">{giftName}</h4>
              <p className="text-sm text-gray-500 mb-3">{purchase.recipient_name && `For ${purchase.recipient_name}`}</p>
              <div className="flex items-center justify-between mt-auto">
                <span className="font-semibold text-primary">${purchase.price_paid}</span>
                <span className="text-xs text-gray-400">{new Date(purchase.purchased_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// 3. Main Dashboard Layout
export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const firstName = user.user_metadata?.first_name || user.email?.split('@')[0] || "there";

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-primary">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {firstName}.</h1>
        <p className="text-gray-500 mt-1">Here is what&apos;s coming up in your gifting calendar.</p>
      </div>

      {/* Custom extras CTA */}
      <Link
        href="/extras"
        className="group block mb-10 rounded-3xl bg-gradient-to-r from-primary to-accent p-6 sm:p-8 text-white shadow-lg shadow-primary/10 transition-transform hover:-translate-y-0.5"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold">Make it unforgettable</h2>
              <p className="text-white/80 text-sm mt-0.5 flex items-center gap-2">
                <Music className="w-4 h-4" /> Order a custom song or a greeting card in your own words.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-xl bg-white text-primary px-5 py-2.5 text-sm font-semibold group-hover:gap-3 transition-all">
            Order now <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </Link>

      {/* Stats Row */}
      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats userId={user.id} />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Occasions */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Upcoming Events</h2>
            <Link href="/dashboard/occasions" className="text-sm font-semibold text-accent hover:underline">
              View All
            </Link>
          </div>
          
          <Suspense fallback={<OccasionsSkeleton />}>
            <UpcomingOccasions userId={user.id} />
          </Suspense>
        </div>

        {/* Right Column: Purchases */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Gifts</h2>
            <Link href="/dashboard/gifts" className="text-sm font-semibold text-accent hover:underline">
              History
            </Link>
          </div>
          
          <Suspense fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="bg-gray-100 rounded-2xl h-64 animate-pulse" />)}
            </div>
          }>
            <RecentPurchases userId={user.id} />
          </Suspense>
        </div>

      </div>
    </div>
  );
}
