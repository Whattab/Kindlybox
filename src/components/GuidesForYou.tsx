import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { GiftImage } from "@/components/GiftImage";
import { BookOpen, ArrowRight } from "lucide-react";

// Published gift guides matched to what the quiz already knows about this
// shopper — who they're buying for, the occasion, and their interests.
//
// This is the highest-intent moment on the site: they've just told us exactly
// what they want. Renders nothing at all when no guides are published yet, so
// it can ship before the blog has content.

// Quiz recipient keys → the words a guide's title/keywords would actually use.
const RECIPIENT_TERMS: Record<string, string[]> = {
  her: ["her", "women", "woman", "wife", "girlfriend"],
  him: ["him", "men", "man", "husband", "boyfriend"],
  mom: ["mom", "mother", "mum"],
  dad: ["dad", "father"],
  parent: ["parent", "parents", "mom", "dad"],
  partner: ["partner", "wife", "husband", "girlfriend", "boyfriend", "couple"],
  friend: ["friend", "friends"],
  sibling: ["sibling", "sister", "brother"],
  child: ["kid", "kids", "child", "children"],
  coworker: ["coworker", "colleague", "co-worker"],
  "co-worker": ["coworker", "colleague", "co-worker"],
  graduate: ["graduate", "graduation"],
};

interface QuizAnswers {
  recipient?: string;
  occasion?: string;
  interests?: string[];
}

export async function GuidesForYou({
  answers,
  limit = 3,
}: {
  answers: QuizAnswers | null | undefined;
  limit?: number;
}) {
  // Anon client: RLS means only PUBLISHED guides can come back.
  const supabase = createClient();
  const { data } = await supabase
    .from("articles")
    .select("slug, title, excerpt, hero_image_url, primary_keyword, secondary_keywords, published_at")
    .eq("status", "PUBLISHED")
    .order("published_at", { ascending: false })
    .limit(24);

  const guides = data ?? [];
  if (guides.length === 0) return null;

  const recipient = String(answers?.recipient || "").toLowerCase().trim();
  const occasion = String(answers?.occasion || "").toLowerCase().trim();
  const recipientTerms = RECIPIENT_TERMS[recipient] ?? (recipient ? [recipient] : []);

  // Whole-word match, so "her" doesn't match inside "gathering".
  const hasTerm = (hay: string, term: string) => {
    const t = term.trim();
    if (t.length < 3) return false;
    return new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(hay);
  };

  // Quiz answers and article keywords rarely spell things the same way:
  // "house warming" vs "housewarming", "home & kitchen" vs "home gifts".
  // Match the phrase, the closed-up form, and the significant words.
  const variants = (phrase: string) => {
    const words = phrase.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    return [phrase, phrase.replace(/[^a-z0-9]+/g, ""), ...words].filter((v) => v.length > 2);
  };

  const interestGroups = (answers?.interests ?? [])
    .map((i) => variants(String(i).toLowerCase().trim()))
    .filter((g) => g.length > 0);
  const occasionVariants = occasion ? variants(occasion) : [];

  // Recipient match matters most, then occasion, then each shared interest.
  const score = (a: (typeof guides)[number]) => {
    const hay = [a.title, a.primary_keyword, ...(a.secondary_keywords ?? [])].filter(Boolean).join(" ").toLowerCase();
    let s = 0;
    if (recipientTerms.some((t) => hasTerm(hay, t))) s += 3;
    if (occasionVariants.some((v) => hasTerm(hay, v))) s += 2;
    s += interestGroups.filter((g) => g.some((v) => hasTerm(hay, v))).length;
    return s;
  };

  const scored = guides
    .map((g) => ({ guide: g, score: score(g) }))
    .sort((a, b) => b.score - a.score);

  // Prefer genuine matches; fall back to the newest guides rather than nothing.
  const matched = scored.filter((s) => s.score > 0);
  const shortlist = (matched.length > 0 ? matched : scored).slice(0, limit).map((s) => s.guide);
  const isMatched = matched.length > 0;

  return (
    <div className="max-w-2xl mx-auto mt-16">
      <div className="text-center mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500 mb-2 inline-flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-accent" /> Keep browsing
        </p>
        <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-primary leading-snug">
          {isMatched ? "Gift guides for this occasion" : "More gift ideas"}
        </h2>
      </div>

      <div className="space-y-3">
        {shortlist.map((g) => (
          <Link
            key={g.slug}
            href={`/blog/${g.slug}`}
            className="group flex items-center gap-4 rounded-2xl border border-primary/5 bg-[#FBF6EE] p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
              <GiftImage src={g.hero_image_url} alt={g.title} />
            </div>
            <div className="min-w-0 flex-grow">
              <p className="font-serif text-lg font-bold text-primary leading-snug group-hover:text-accent transition-colors">
                {g.title}
              </p>
              {g.excerpt && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{g.excerpt}</p>}
            </div>
            <ArrowRight className="w-4 h-4 text-accent flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ))}
      </div>
    </div>
  );
}
