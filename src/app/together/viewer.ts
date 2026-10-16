// Server-only: who is viewing a group page, from the cookies the actions set.
// Kept out of actions.ts so it is not exposed as a callable server action.

import { cookies } from "next/headers";

export const keyCookie = (groupId: string) => `kb_gg_k_${groupId}`;
export const memberCookie = (groupId: string) => `kb_gg_m_${groupId}`;

export function viewerFor(groupId: string) {
  const jar = cookies();
  return { key: jar.get(keyCookie(groupId))?.value ?? null, memberId: jar.get(memberCookie(groupId))?.value ?? null };
}
