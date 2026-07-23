import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ArrowRight, RedoDot, Check } from "lucide-react";
import { ShareButtons } from "@/components/ShareButtons";
import { GiftImage } from "@/components/GiftImage";
import { saveGiftToProfile } from "./actions";
import { rankLabel, interestChips, pronounFor } from "@/lib/quiz-labels";

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

  // Header copy: "FOR SARAH · BIRTHDAY" (or just "BIRTHDAY PICKS" with no name),
  // and a pronoun-aware headline ("picked for her") from the gender answer.
  const occasion: string = session.answers?.occasion || "";
  const eyebrow = recipientName
    ? `For ${recipientName} · ${occasion}`
    : `${occasion} picks`;
  const pronoun = pronounFor(session.answers?.gender);
  const chips = interestChips(session.answers?.interests);

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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent mb-4">
            {eyebrow}
          </p>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-6">
            {suggestions.length === 3 ? "Three gifts," : `${suggestions.length} gifts,`}
            <br />
            <span className="italic text-accent">picked for {pronoun}.</span>
          </h1>
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5 text-accent" />
                  {chip}
                </span>
              ))}
            </div>
          )}
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

        <div className="flex flex-col gap-6 max-w-2xl mx-auto">
          {suggestions.map((suggestion: any, index: number) => {
            const gift = suggestion.gifts;
            return (
              <div
                key={suggestion.id}
                className="bg-[#FBF6EE] rounded-3xl p-5 sm:p-6 shadow-xl shadow-primary/5 border border-primary/5 group transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
                    <GiftImage src={gift.image_url} alt={gift.name} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent mb-1">
                      {rankLabel(index)}
                    </p>
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-primary leading-tight">
                      {gift.name}
                    </h3>
                  </div>
                </div>

                {suggestion.personalized_reason ? (
                  <p className="font-hand text-2xl sm:text-3xl text-primary/90 leading-snug mt-4 break-words">
                    &ldquo;{suggestion.personalized_reason}&rdquo;
                  </p>
                ) : (
                  <p className="text-gray-600 text-sm leading-relaxed mt-4">
                    {gift.description}
                  </p>
                )}

                <div className="mt-5 pt-4 border-t border-dashed border-gray-200 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-primary text-lg">
                      ${gift.price_min} - ${gift.price_max}
                    </div>

                    <a
                      href={gift.affiliate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md group/btn"
                    >
                      Buy gift
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
                        className="w-full rounded-full border border-primary/10 bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
                      >
                        Save to profile
                      </button>
                    </form>
                  ) : (
                    <Link
                      href={`/auth/login?next=/results/${params.sessionId}`}
                      className="block w-full rounded-full border border-primary/10 bg-white px-4 py-2 text-center text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
                    >
                      Save to profile
                    </Link>
                  )}
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
