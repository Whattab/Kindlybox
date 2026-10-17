import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { ArrowRight, CheckCircle2, Clock, HeartHandshake } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/admin";
import { normalizeSuggestion, SUGGESTION_SELECT } from "@/lib/quiz-email";
import { claimBrowserGroups } from "@/app/together/viewer";

export const dynamic = "force-dynamic";

// Group gifts this account organised. Groups started while signed out are
// picked up here too: any group whose organiser key is in this browser is
// linked to the account on first visit (claimBrowserGroups).
export default async function GroupGiftsPage() {
  noStore();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // group_gifts is service-role only — read with the service client, scoped
  // strictly to this user's id.
  const db = createServiceClient();
  await claimBrowserGroups(db, user);

  const { data: groups } = await db
    .from("group_gifts")
    .select("id, created_at, organiser_name, total_amount, chosen_suggestion_id, quiz_sessions(answers), group_gift_members(count)")
    .eq("organiser_user_id", user.id)
    .order("created_at", { ascending: false });
  const list = groups ?? [];

  // Names of the chosen gifts, in one query.
  const chosenIds = list.map((g) => g.chosen_suggestion_id).filter(Boolean) as string[];
  const chosenName: Record<string, string> = {};
  if (chosenIds.length) {
    const { data: sugs } = await db.from("gift_suggestions").select(SUGGESTION_SELECT).in("id", chosenIds);
    for (const s of sugs || []) {
      const n = normalizeSuggestion(s);
      if (n) chosenName[s.id] = n.gift.name;
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
          <HeartHandshake className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">Group Gifts</h1>
          <p className="text-gray-500 mt-0.5">Gifts you&apos;re organising with friends.</p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-12 px-6 bg-white rounded-2xl border border-dashed border-gray-200">
          <p className="text-gray-500 mb-4">
            No group gifts yet. Take the quiz, then tap <strong>Gift together</strong> on your results to chip in with friends.
          </p>
          <Link href="/quiz" className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-5 py-2.5 text-sm font-semibold hover:bg-primary/90">
            Find a gift <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((g) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const answers = (g as any).quiz_sessions?.answers || {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const people: number = (g as any).group_gift_members?.[0]?.count ?? 0;
            const recipient = answers.recipientName?.trim();
            const title = recipient ? `For ${recipient}` : "Group gift";
            const chosen = g.chosen_suggestion_id ? chosenName[g.chosen_suggestion_id] : null;
            return (
              <div key={g.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-serif text-xl font-bold text-primary">{title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {answers.occasion ? `${answers.occasion} · ` : ""}
                      Started {new Date(g.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {" · "}{people} {people === 1 ? "person" : "people"} in
                    </p>
                  </div>
                  {chosen ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent flex-shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Gift chosen
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 flex-shrink-0">
                      <Clock className="w-3.5 h-3.5" /> Voting
                    </span>
                  )}
                </div>
                {chosen && (
                  <p className="text-sm text-gray-700 mt-3 truncate">
                    {chosen}{g.total_amount != null ? ` · $${Number(g.total_amount).toFixed(2)} total` : ""}
                  </p>
                )}
                <Link href={`/together/${g.id}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary text-white px-5 py-2 text-sm font-semibold hover:bg-primary/90">
                  Open group <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
