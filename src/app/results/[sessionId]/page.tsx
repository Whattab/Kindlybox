import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Gift, ArrowRight, RedoDot } from "lucide-react";
import { ShareButtons } from "@/components/ShareButtons";
import { saveGiftToProfile } from "./actions";

export default async function ResultsPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch session
  const { data: session } = await supabase
    .from("quiz_sessions")
    .select("*")
    .eq("id", params.sessionId)
    .single();

  if (!session) {
    return notFound();
  }

  // Fetch suggestions
  const { data: suggestions } = await supabase
    .from("gift_suggestions")
    .select(`
      id,
      match_score,
      rank,
      personalized_reason,
      gifts (id, name, description, image_url, price_min, price_max, affiliate_url)
    `)
    .eq("session_id", session.id)
    .order("rank", { ascending: true });

  if (!suggestions || suggestions.length === 0) {
    return notFound();
  }

  // Generate share link
  const domain = process.env.NEXT_PUBLIC_APP_URL || "https://kindlybox.com";
  const shareLink = `${domain}/results/${session.id}`;
  const recipientName = session.answers?.recipientName?.trim();

  return (
    <main className="min-h-screen bg-background">
      <header className="px-6 py-4 border-b border-primary/5 bg-white shadow-sm flex items-center justify-between">
        <Link href="/">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-primary hover:text-primary/80 transition-colors">
            KindlyBox
          </h1>
        </Link>
        <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-accent">
          My Dashboard
        </Link>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center justify-center p-3 bg-accent/10 rounded-full mb-4">
            <Gift className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
            Your Perfect Matches
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            We&apos;ve analyzed your answers and hand-picked these {suggestions.length} premium gifts for {session.answers.recipient === 'partner' ? 'your partner' : `your ${session.answers.recipient}`}.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <Link 
              href="/quiz"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-accent transition-colors bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100"
            >
              <RedoDot className="w-4 h-4" />
              Retake Quiz
            </Link>
            <ShareButtons shareLink={shareLink} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {suggestions.map((suggestion: any, index: number) => {
            const gift = suggestion.gifts;
            return (
              <div 
                key={suggestion.id}
                className="bg-white rounded-3xl overflow-hidden shadow-xl shadow-primary/5 flex flex-col group transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
                  <Image
                    src={gift.image_url}
                    alt={gift.name}
                    fill
                    className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 z-10">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                    </span>
                    <span className="text-xs font-bold text-primary whitespace-nowrap">
                      {Math.round(suggestion.match_score)}% Match
                    </span>
                  </div>
                </div>

                <div className="p-6 flex flex-col flex-grow">
                  <div className="mb-4">
                    <h3 className="font-serif text-2xl font-bold text-primary mb-2 line-clamp-1 group-hover:text-accent transition-colors">
                      {gift.name}
                    </h3>
                    {suggestion.personalized_reason ? (
                      <div className="rounded-2xl border border-accent/20 bg-accent/5 p-3 mb-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent mb-1.5">
                          Why it fits{recipientName ? ` for ${recipientName}` : ""}
                        </p>
                        <p className="text-sm text-primary/90 leading-relaxed whitespace-pre-wrap break-words">
                          {suggestion.personalized_reason}
                        </p>
                      </div>
                    ) : null}
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {gift.description}
                    </p>
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-primary bg-primary/5 px-3 py-1 rounded-lg text-sm">
                        ${gift.price_min} - ${gift.price_max}
                      </div>
                      
                      <a
                        href={gift.affiliate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md group/btn"
                      >
                        Buy Now
                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                      </a>
                    </div>

                    {user ? (
                      <form action={saveGiftToProfile} className="w-full">
                        <input type="hidden" name="gift_name" value={gift.name} />
                        <input type="hidden" name="gift_description" value={gift.description || ""} />
                        <input type="hidden" name="gift_id" value={gift.id || ""} />
                        <input type="hidden" name="image_url" value={gift.image_url || ""} />
                        <input type="hidden" name="price_paid" value={gift.price_max || gift.price_min || 0} />
                        <input type="hidden" name="session_id" value={params.sessionId} />
                        <button
                          type="submit"
                          className="w-full rounded-xl border border-primary/10 bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
                        >
                          Save to profile
                        </button>
                      </form>
                    ) : (
                      <Link
                        href={`/auth/login?next=/results/${params.sessionId}`}
                        className="block w-full rounded-xl border border-primary/10 bg-white px-4 py-2 text-center text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
                      >
                        Save to profile
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-center text-xs text-gray-400 mt-12 max-w-2xl mx-auto">
          KindlyBox may earn a commission from purchases made through links on this page, at no extra cost to you.
        </p>
      </div>
    </main>
  );
}
