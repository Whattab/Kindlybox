// Quiz results email — shared by the quiz submit route (v1 / logged-in, sent at
// submit) and the results page's "Email me these picks" (v2, Step 6c).

import * as React from "react";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import GiftSuggestionsEmail from "@/emails/GiftSuggestions";

const resend = new Resend(process.env.RESEND_API_KEY!);

/** The shape the email template renders. */
export interface EmailPick {
  gift: {
    id: string; name: string; description: string; image_url: string;
    price_min: number; price_max: number; affiliate_url: string | null; affiliate_network?: string | null;
  };
  matchScorePercent: number;
  personalizedReason?: string | null;
}

/** Columns the results page and the email both select for a stored pick. */
export const SUGGESTION_SELECT = `
  id, match_score, rank, personalized_reason, source, product_id,
  gifts (id, name, description, image_url, price_min, price_max, affiliate_url, affiliate_network),
  products (id, title, description, image_url, price, affiliate_link)
`;

/**
 * A stored pick is either a curated gift or an affiliate product — normalize
 * both into one gift shape. Returns null when the joined row is missing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeSuggestion(s: any): { gift: EmailPick["gift"]; isProduct: boolean } | null {
  const isProduct = s.source === "product" || (!s.gifts && s.products);
  const p = s.products;
  const gift = isProduct && p
    ? {
        id: p.id, name: p.title, description: p.description, image_url: p.image_url,
        price_min: p.price, price_max: p.price, affiliate_url: p.affiliate_link, affiliate_network: null,
      }
    : s.gifts;
  return gift ? { gift, isProduct: !!isProduct } : null;
}

/** Rebuild a session's picks (in rank order) for the email. */
export async function loadSessionPicks(db: SupabaseClient, sessionId: string): Promise<EmailPick[]> {
  const { data } = await db.from("gift_suggestions").select(SUGGESTION_SELECT).eq("session_id", sessionId).order("rank", { ascending: true });
  return (data || []).flatMap((s) => {
    const n = normalizeSuggestion(s);
    return n ? [{ gift: n.gift, matchScorePercent: s.match_score ?? 0, personalizedReason: s.personalized_reason ?? null }] : [];
  });
}

/**
 * Send the "your gifts are here" email. Fail-soft: returns false instead of
 * throwing, because a failed email must never break the quiz.
 */
export async function sendResultsEmail(opts: {
  to: string; firstName?: string; recommendations: EmailPick[]; sessionId: string;
}): Promise<boolean> {
  const { to, firstName, recommendations, sessionId } = opts;
  try {
    console.log("[email] Attempting to send to:", to, "from:", process.env.RESEND_FROM_EMAIL);
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "hello@kindlybox.com",
      to,
      subject: `Your 3 perfect gifts are here${firstName ? `, ${firstName}` : ""} 🎁`,
      react: React.createElement(GiftSuggestionsEmail, { firstName, recommendations, sessionId }),
    });
    // Resend returns errors INSIDE the response object, not as exceptions.
    // We must check result.error explicitly to know if delivery actually failed.
    if (result?.error) {
      console.error("[email] Resend returned an error:", JSON.stringify(result.error, null, 2));
      return false;
    }
    console.log("[email] Resend accepted with id:", result?.data?.id);
    return true;
  } catch (emailErr) {
    console.error("[email] Exception while sending:", emailErr);
    return false;
  }
}
