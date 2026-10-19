"use server";

// Group gifting ("Gift together"). KindlyBox never touches the money: the page
// splits the total and links to the organiser's Venmo / PayPal / Cash App.
//
// Who-is-who is cookie based (no login needed): the organiser's browser holds
// the group's secret manage key, each friend's browser holds their member id.
// The organiser also gets a private link (?k=<key>), can email it to
// themselves, and — when signed in — the group is linked to their account
// (Dashboard → Group Gifts), where the page hands their browser the key. Errors are returned, not thrown — Next redacts thrown errors in prod.

import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { createServiceClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { looksLikeEmail } from "@/lib/email-typo";
import { sendOrganiserLinkEmail } from "@/lib/group-gift-email";
import {
  MAX_MEMBERS, MAX_NOTE, cleanName, venmoHandle, paypalHandle, cashappHandle, parseAmount, sameKey,
} from "@/lib/group-gift";
import { COOKIE_PATH, keyCookie, memberCookie, viewerFor } from "./viewer";

export type GroupResult = { ok: true; id?: string; key?: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_GROUPS_PER_SESSION = 20;
const COOKIE_DAYS = 180;
const MAX_LINK_EMAILS = 5;

function setCookie(name: string, value: string) {
  cookies().set(name, value, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH, maxAge: COOKIE_DAYS * 24 * 60 * 60,
  });
}

/** Does this suggestion belong to the group's quiz session? */
async function suggestionInSession(db: ReturnType<typeof createServiceClient>, sessionId: string, suggestionId: string) {
  if (!UUID.test(suggestionId)) return false;
  const { data } = await db.from("gift_suggestions").select("id").eq("id", suggestionId).eq("session_id", sessionId).maybeSingle();
  return !!data;
}

async function loadGroup(db: ReturnType<typeof createServiceClient>, groupId: string) {
  if (!UUID.test(groupId || "")) return null;
  const { data } = await db.from("group_gifts").select("id, session_id, manage_key").eq("id", groupId).maybeSingle();
  return data;
}

/** The organiser is whoever holds the key: passed from the page (a ?k= link or
 *  their account), else the cookie. */
function isOrganiser(groupId: string, groupKey: string, passedKey?: string | null) {
  return sameKey(groupKey, passedKey || viewerFor(groupId).key);
}

/** This browser's member row: its cookie, else the organiser's row when the
 *  organiser is on a device without one (opened from the dashboard). */
async function myMemberId(db: ReturnType<typeof createServiceClient>, group: { id: string; manage_key: string }, key?: string | null) {
  const { memberId } = viewerFor(group.id);
  if (memberId && UUID.test(memberId)) return memberId;
  if (!key || !sameKey(group.manage_key, key)) return null;
  const { data } = await db.from("group_gift_members").select("id").eq("group_id", group.id).eq("is_organiser", true).limit(1).maybeSingle();
  return data?.id ?? null;
}

// ── Organiser: create ────────────────────────────────────────────────────
export async function createGroup(input: {
  sessionId: string; organiserName: string; note?: string;
  venmo?: string; paypal?: string; cashapp?: string;
}): Promise<GroupResult> {
  const name = cleanName(input.organiserName);
  if (!UUID.test(input.sessionId || "")) return { ok: false, error: "We couldn't find these picks." };
  if (!name) return { ok: false, error: "Please add your name so friends know who's organising." };

  const venmo = input.venmo?.trim() ? venmoHandle(input.venmo) : null;
  const paypal = input.paypal?.trim() ? paypalHandle(input.paypal) : null;
  const cashapp = input.cashapp?.trim() ? cashappHandle(input.cashapp) : null;
  if (input.venmo?.trim() && !venmo) return { ok: false, error: "That Venmo username doesn't look right. It's on your Venmo profile, e.g. @Jess-Smith-7." };
  if (input.paypal?.trim() && !paypal) return { ok: false, error: "For PayPal, enter the email you use for PayPal, or your PayPal.me name (letters and numbers only, e.g. JessSmith7)." };
  if (input.cashapp?.trim() && !cashapp) return { ok: false, error: "That Cash App $cashtag doesn't look right. It's on your Cash App profile, e.g. $JessS7." };
  if (!venmo && !paypal && !cashapp) return { ok: false, error: "Add at least one way for friends to pay you back." };

  const db = createServiceClient();
  const { data: session } = await db.from("quiz_sessions").select("id").eq("id", input.sessionId).maybeSingle();
  if (!session) return { ok: false, error: "We couldn't find these picks." };

  const { count } = await db.from("group_gifts").select("id", { count: "exact", head: true }).eq("session_id", session.id);
  if ((count ?? 0) >= MAX_GROUPS_PER_SESSION) return { ok: false, error: "Too many groups for these picks. Retake the quiz to start fresh." };

  // Signed in? Link the group to the account so it's on their dashboard.
  const { data: { user } } = await createClient().auth.getUser();

  const key = randomBytes(18).toString("base64url");
  const { data: group, error } = await db.from("group_gifts").insert({
    session_id: session.id, manage_key: key, organiser_name: name,
    organiser_user_id: user?.id ?? null, organiser_email: user?.email ?? null,
    note: cleanName(input.note, MAX_NOTE) || null,
    pay_venmo: venmo, pay_paypal: paypal, pay_cashapp: cashapp,
  }).select("id").single();
  if (error || !group) {
    console.error("createGroup", error);
    return { ok: false, error: "Couldn't create the group. Please try again." };
  }

  const { data: me } = await db.from("group_gift_members")
    .insert({ group_id: group.id, name, is_organiser: true }).select("id").single();

  setCookie(keyCookie(group.id), key);
  if (me) setCookie(memberCookie(group.id), me.id);
  return { ok: true, id: group.id, key };
}

// ── Friends: join / change vote ──────────────────────────────────────────
export async function joinGroup(groupId: string, rawName: string, voteId: string | null): Promise<GroupResult> {
  const name = cleanName(rawName);
  if (!name) return { ok: false, error: "Please add your name." };
  const db = createServiceClient();
  const group = await loadGroup(db, groupId);
  if (!group) return { ok: false, error: "This group no longer exists." };
  if (voteId && !(await suggestionInSession(db, group.session_id, voteId))) voteId = null;

  // Already in (same browser)? Update rather than add a duplicate.
  const { memberId } = viewerFor(group.id);
  if (memberId && UUID.test(memberId)) {
    const { data: existing } = await db.from("group_gift_members").update({ name, vote_suggestion_id: voteId })
      .eq("id", memberId).eq("group_id", group.id).select("id").maybeSingle();
    if (existing) return { ok: true };
  }

  const { count } = await db.from("group_gift_members").select("id", { count: "exact", head: true }).eq("group_id", group.id);
  if ((count ?? 0) >= MAX_MEMBERS) return { ok: false, error: "This group is full." };

  const { data: me, error } = await db.from("group_gift_members")
    .insert({ group_id: group.id, name, vote_suggestion_id: voteId }).select("id").single();
  if (error || !me) {
    console.error("joinGroup", error);
    return { ok: false, error: "Couldn't add you. Please try again." };
  }
  setCookie(memberCookie(group.id), me.id);
  return { ok: true };
}

export async function castVote(groupId: string, voteId: string, key?: string | null): Promise<GroupResult> {
  const db = createServiceClient();
  const group = await loadGroup(db, groupId);
  if (!group) return { ok: false, error: "This group no longer exists." };
  const memberId = await myMemberId(db, group, key);
  if (!memberId) return { ok: false, error: "Join the group first." };
  if (!(await suggestionInSession(db, group.session_id, voteId))) return { ok: false, error: "That gift isn't in this group." };
  const { data } = await db.from("group_gift_members").update({ vote_suggestion_id: voteId })
    .eq("id", memberId).eq("group_id", group.id).select("id").maybeSingle();
  return data ? { ok: true } : { ok: false, error: "Join the group first." };
}

export async function leaveGroup(groupId: string): Promise<GroupResult> {
  const db = createServiceClient();
  const group = await loadGroup(db, groupId);
  if (!group) return { ok: false, error: "This group no longer exists." };
  const { memberId } = viewerFor(group.id);
  if (!memberId || !UUID.test(memberId)) return { ok: true };
  await db.from("group_gift_members").delete().eq("id", memberId).eq("group_id", group.id).eq("is_organiser", false);
  cookies().delete({ name: memberCookie(group.id), path: COOKIE_PATH });
  cookies().delete({ name: memberCookie(group.id), path: "/together" }); // first groups' cookies
  return { ok: true };
}

// ── Organiser: choose the gift, set the total, tidy the list ─────────────
export async function lockInGift(groupId: string, suggestionId: string, total: string, key?: string | null): Promise<GroupResult> {
  const db = createServiceClient();
  const group = await loadGroup(db, groupId);
  if (!group) return { ok: false, error: "This group no longer exists." };
  if (!isOrganiser(group.id, group.manage_key, key)) return { ok: false, error: "Only the organiser can do that." };
  if (!(await suggestionInSession(db, group.session_id, suggestionId))) return { ok: false, error: "Pick one of the gifts first." };
  const amount = parseAmount(total);
  if (!amount) return { ok: false, error: "Enter the total price, e.g. 89.99." };
  const { error } = await db.from("group_gifts").update({ chosen_suggestion_id: suggestionId, total_amount: amount }).eq("id", group.id);
  return error ? { ok: false, error: "Couldn't save. Please try again." } : { ok: true };
}

export async function unlockGift(groupId: string, key?: string | null): Promise<GroupResult> {
  const db = createServiceClient();
  const group = await loadGroup(db, groupId);
  if (!group) return { ok: false, error: "This group no longer exists." };
  if (!isOrganiser(group.id, group.manage_key, key)) return { ok: false, error: "Only the organiser can do that." };
  await db.from("group_gifts").update({ chosen_suggestion_id: null, total_amount: null }).eq("id", group.id);
  return { ok: true };
}

export async function removeMember(groupId: string, memberId: string, key?: string | null): Promise<GroupResult> {
  const db = createServiceClient();
  const group = await loadGroup(db, groupId);
  if (!group) return { ok: false, error: "This group no longer exists." };
  if (!isOrganiser(group.id, group.manage_key, key)) return { ok: false, error: "Only the organiser can do that." };
  if (!UUID.test(memberId || "")) return { ok: false, error: "Couldn't find that person." };
  await db.from("group_gift_members").delete().eq("id", memberId).eq("group_id", group.id).eq("is_organiser", false);
  return { ok: true };
}

// ── Organiser: email myself the organiser link ───────────────────────────
// For organisers who don't sign in. Organiser-only, capped per group so the
// form can't be used to send mail to arbitrary addresses at volume.
export async function emailOrganiserLink(groupId: string, email: string, key?: string | null): Promise<GroupResult> {
  const to = (email || "").trim();
  if (!looksLikeEmail(to) || to.length > 254) return { ok: false, error: "Please enter a valid email address." };
  const db = createServiceClient();
  const group = await loadGroup(db, groupId);
  if (!group) return { ok: false, error: "This group no longer exists." };
  if (!isOrganiser(group.id, group.manage_key, key)) return { ok: false, error: "Only the organiser can do that." };

  const { data: g } = await db.from("group_gifts")
    .select("organiser_name, link_emails_sent, quiz_sessions(answers)").eq("id", group.id).single();
  if (!g) return { ok: false, error: "This group no longer exists." };
  if ((g.link_emails_sent ?? 0) >= MAX_LINK_EMAILS) return { ok: false, error: "We've already sent this link several times — check your inbox and spam folder." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const answers = (g as any).quiz_sessions?.answers || {};
  const domain = process.env.NEXT_PUBLIC_APP_URL || "https://kindlybox.com";
  const sent = await sendOrganiserLinkEmail({
    to, organiserName: g.organiser_name, recipientName: answers.recipientName?.trim() || "",
    organiserLink: `${domain}/together/${group.id}?k=${group.manage_key}`,
    inviteLink: `${domain}/together/${group.id}`,
  });
  if (!sent) return { ok: false, error: "Couldn't send the email. Please try again." };
  await db.from("group_gifts").update({ organiser_email: to, link_emails_sent: (g.link_emails_sent ?? 0) + 1 }).eq("id", group.id);
  return { ok: true };
}

// ── Organiser: delete the group ──────────────────────────────────────────
// Removes the group and everyone's votes (members cascade). The invite link
// stops working for everyone.
export async function deleteGroup(groupId: string, key?: string | null): Promise<GroupResult> {
  const db = createServiceClient();
  const group = await loadGroup(db, groupId);
  if (!group) return { ok: true }; // already gone
  if (!isOrganiser(group.id, group.manage_key, key)) return { ok: false, error: "Only the organiser can delete this group." };
  const { error } = await db.from("group_gifts").delete().eq("id", group.id);
  if (error) {
    console.error("deleteGroup", error);
    return { ok: false, error: "Couldn't delete the group. Please try again." };
  }
  for (const name of [keyCookie(group.id), memberCookie(group.id)]) {
    cookies().delete({ name, path: COOKIE_PATH });
    cookies().delete({ name, path: "/together" }); // first groups' cookies
  }
  return { ok: true };
}
