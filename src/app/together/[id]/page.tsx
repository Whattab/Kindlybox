import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import { ArrowRight, Users } from "lucide-react";
import { createServiceClient } from "@/utils/supabase/admin";
import { GiftImage } from "@/components/GiftImage";
import { normalizeSuggestion, SUGGESTION_SELECT } from "@/lib/quiz-email";
import { isAmazonItem, AMAZON_PRICE_PLACEHOLDER } from "@/lib/amazon-display";
import { payLinks, sameKey, splitShare, tallyVotes } from "@/lib/group-gift";
import { viewerFor } from "../viewer";
import {
  ChooseGift, CopyText, InviteButton, JoinCard, RemoveMemberButton, UnlockButton, VoteButton,
} from "./GroupControls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gift together · KindlyBox", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Member = { id: string; name: string; vote_suggestion_id: string | null; is_organiser: boolean };

export default async function GroupPage({
  params, searchParams,
}: { params: { id: string }; searchParams?: { k?: string; new?: string } }) {
  // Votes and members change every few seconds — never serve a cached Supabase read.
  noStore();
  if (!UUID.test(params.id)) return notFound();
  const db = createServiceClient();

  const { data: group } = await db.from("group_gifts").select("*").eq("id", params.id).maybeSingle();
  if (!group) return notFound();

  const [{ data: session }, { data: suggestions }, { data: memberRows }] = await Promise.all([
    db.from("quiz_sessions").select("id, answers").eq("id", group.session_id).maybeSingle(),
    db.from("gift_suggestions").select(SUGGESTION_SELECT).eq("session_id", group.session_id).order("rank", { ascending: true }),
    db.from("group_gift_members").select("id, name, vote_suggestion_id, is_organiser").eq("group_id", group.id).order("created_at"),
  ]);
  const members = (memberRows || []) as Member[];

  // Who is looking? Organiser = holds the key (cookie, or the private ?k= link).
  const viewer = viewerFor(group.id);
  const urlKey = searchParams?.k || null;
  const orgKey = sameKey(group.manage_key, urlKey) ? urlKey : sameKey(group.manage_key, viewer.key) ? viewer.key : null;
  const me = members.find((m) => m.id === viewer.memberId) || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const picks = (suggestions || []).flatMap((s: any) => {
    const n = normalizeSuggestion(s);
    if (!n) return [];
    const isAmazon = !n.isProduct && isAmazonItem({ affiliate_network: s.gifts?.affiliate_network, url: s.gifts?.affiliate_url });
    const { price_min, price_max } = n.gift;
    const priceLabel = isAmazon ? AMAZON_PRICE_PLACEHOLDER
      : `$${price_min}${price_max && price_max !== price_min ? ` – $${price_max}` : ""}`;
    // Amazon prices are never pre-filled (Associates rule); others start at the top of the range.
    const defaultTotal = isAmazon ? "" : String(price_max || price_min || "");
    return [{ id: s.id as string, gift: n.gift, priceLabel, defaultTotal }];
  });
  const votes = tallyVotes(members);
  const chosen = picks.find((p) => p.id === group.chosen_suggestion_id) || null;
  const total = group.total_amount != null ? Number(group.total_amount) : null;
  const share = chosen ? splitShare(total, members.length) : null;
  const pay = payLinks(group, share);

  const recipient: string = session?.answers?.recipientName?.trim() || "";
  const occasion: string = session?.answers?.occasion || "";
  const domain = process.env.NEXT_PUBLIC_APP_URL || "https://kindlybox.com";
  const inviteLink = `${domain}/together/${group.id}`;
  const organiserLink = `${inviteLink}?k=${group.manage_key}`;
  const headline = recipient ? `Let's chip in for ${recipient}` : "Let's chip in together";

  return (
    <main className="min-h-screen bg-background">
      <header className="px-6 py-4 border-b border-primary/5 bg-white shadow-sm">
        <Link href="/">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-primary hover:text-primary/80 transition-colors">KindlyBox</h1>
        </Link>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent mb-3">
            Gift together{occasion ? ` · ${occasion}` : ""}
          </p>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary">{headline}</h2>
          <p className="text-gray-600 mt-2">
            <strong>{group.organiser_name}</strong> is organising · {members.length} {members.length === 1 ? "person" : "people"} in
          </p>
          {group.note && <p className="font-hand text-2xl text-primary/90 mt-4">&ldquo;{group.note}&rdquo;</p>}
          <div className="mt-5"><InviteButton link={inviteLink} title={headline} /></div>
        </div>

        {orgKey && searchParams?.new === "1" && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-gray-700 space-y-2">
            <p className="font-semibold text-primary">Your group page is ready 🎉</p>
            <p>Tap <strong>Invite friends</strong> to send the link. To manage the group from another phone or computer, keep this private organiser link (don&apos;t share it):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs">{organiserLink}</code>
              <CopyText text={organiserLink} />
            </div>
          </div>
        )}

        {/* The plan: chosen gift + split + how to pay */}
        {chosen ? (
          <div className="rounded-3xl border border-accent/30 bg-white p-5 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">The gift</p>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                <GiftImage src={chosen.gift.image_url} alt={chosen.gift.name} />
              </div>
              <p className="font-serif text-lg font-bold text-primary leading-tight">{chosen.gift.name}</p>
            </div>
            {total != null && share != null && (
              <div className="rounded-2xl bg-[#FBF6EE] p-4 text-center">
                <p className="text-sm text-gray-600">${total.toFixed(2)} ÷ {members.length} {members.length === 1 ? "person" : "people"}</p>
                <p className="font-serif text-3xl font-bold text-primary">${share.toFixed(2)} <span className="text-base font-sans font-medium text-gray-500">each</span></p>
                <p className="text-xs text-gray-500 mt-1">Goes down as more people join.</p>
              </div>
            )}
            {pay.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-primary mb-2">Send your share to {group.organiser_name}:</p>
                <div className="flex flex-wrap gap-2">
                  {pay.map((l) => (
                    <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                      className="rounded-full border border-primary/15 bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5">
                      {l.label} · {l.handle}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {orgKey && (
              <div className="border-t border-dashed border-gray-200 pt-4 space-y-2">
                <a href={`/go/s/${chosen.id}`} target="_blank" rel="sponsored nofollow noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 shadow-md">
                  Buy the gift <ArrowRight className="w-4 h-4" />
                </a>
                <div><UnlockButton groupId={group.id} orgKey={orgKey} /></div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-gray-600">
            Vote for your favourite below. {orgKey ? "When you're ready, choose the gift and set the total to split." : `${group.organiser_name} will choose the gift and set the total to split.`}
          </p>
        )}

        <JoinCard groupId={group.id} picks={picks.map((p) => ({ id: p.id, name: p.gift.name }))}
          me={me ? { name: me.name, isOrganiser: me.is_organiser } : null} />

        {/* The picks, with votes */}
        <div className="space-y-4">
          {picks.map((p) => {
            const voters = members.filter((m) => m.vote_suggestion_id === p.id).map((m) => m.name);
            return (
              <div key={p.id} className={`rounded-3xl p-5 border shadow-sm ${chosen?.id === p.id ? "bg-white border-accent/40" : "bg-[#FBF6EE] border-primary/5"}`}>
                <div className="flex items-start gap-4">
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
                    <GiftImage src={p.gift.image_url} alt={p.gift.name} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif text-lg font-bold text-primary leading-tight">{p.gift.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{p.priceLabel}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-gray-600">
                    <strong className="text-primary">{votes[p.id] || 0}</strong> {(votes[p.id] || 0) === 1 ? "vote" : "votes"}
                    {voters.length > 0 && <span className="text-gray-400"> · {voters.join(", ")}</span>}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {me && <VoteButton groupId={group.id} suggestionId={p.id} mine={me.vote_suggestion_id === p.id} />}
                    {orgKey && chosen?.id !== p.id && (
                      <ChooseGift groupId={group.id} suggestionId={p.id} orgKey={orgKey} defaultTotal={p.defaultTotal} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Who's in */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="flex items-center gap-2 font-semibold text-primary mb-3"><Users className="w-4 h-4 text-accent" /> Who&apos;s in</p>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <span key={m.id} className="inline-flex items-center rounded-full bg-[#FBF6EE] px-3 py-1 text-sm text-primary">
                {m.name}{m.is_organiser && <span className="ml-1 text-xs text-accent">· organiser</span>}
                {orgKey && !m.is_organiser && <RemoveMemberButton groupId={group.id} memberId={m.id} orgKey={orgKey} name={m.name} />}
              </span>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          KindlyBox doesn&apos;t collect or hold any money. Payments go straight to the organiser.
          KindlyBox may earn a commission from purchases made through links on this page, at no extra cost to you.
        </p>
      </div>
    </main>
  );
}
