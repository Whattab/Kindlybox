// Server-only: who is viewing a group page, from the cookies the actions set
// and the signed-in account. Kept out of actions.ts so none of it is exposed
// as a callable server action.

import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sameKey } from "@/lib/group-gift";

export const keyCookie = (groupId: string) => `kb_gg_k_${groupId}`;
export const memberCookie = (groupId: string) => `kb_gg_m_${groupId}`;

// Path "/" so the dashboard can see which groups this browser organised.
// (The first groups used path "/together"; browsers still send those there.)
export const COOKIE_PATH = "/";

export function viewerFor(groupId: string) {
  const jar = cookies();
  return { key: jar.get(keyCookie(groupId))?.value ?? null, memberId: jar.get(memberCookie(groupId))?.value ?? null };
}

/** Every organiser key this browser holds, by group id. */
export function organiserKeysInBrowser(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of cookies().getAll()) {
    const m = c.name.match(/^kb_gg_k_([0-9a-f-]{36})$/i);
    if (m) out[m[1].toLowerCase()] = c.value;
  }
  return out;
}

/**
 * Link groups this browser organised (by key cookie) to the signed-in account,
 * so they show on the dashboard from any device afterwards. Only claims groups
 * that have no owner yet. Fail-soft.
 */
export async function claimBrowserGroups(
  db: SupabaseClient, user: { id: string; email?: string | null },
): Promise<void> {
  const keys = organiserKeysInBrowser();
  const ids = Object.keys(keys);
  if (ids.length === 0) return;
  try {
    const { data } = await db.from("group_gifts").select("id, manage_key").in("id", ids).is("organiser_user_id", null);
    const mine = (data || []).filter((g) => sameKey(g.manage_key, keys[g.id]));
    if (mine.length === 0) return;
    await db.from("group_gifts")
      .update({ organiser_user_id: user.id, organiser_email: user.email ?? null })
      .in("id", mine.map((g) => g.id))
      .is("organiser_user_id", null);
  } catch (e) {
    console.error("claimBrowserGroups", e);
  }
}
