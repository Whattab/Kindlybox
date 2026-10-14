"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/utils/supabase/admin";
import { looksLikeEmail, suggestEmailFix } from "@/lib/email-typo";
import { loadSessionPicks, sendResultsEmail } from "@/lib/quiz-email";

export async function saveGiftToProfile(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const gift_name = formData.get("gift_name") as string;
  const gift_description = formData.get("gift_description") as string;
  const image_url = formData.get("image_url") as string;
  const gift_id = formData.get("gift_id") as string | null;
  const price_paid = formData.get("price_paid") ? Number(formData.get("price_paid")) : null;
  const session_id = formData.get("session_id") as string;

  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    gift_name,
    gift_id: gift_id || null,
    notes: gift_description || null,
    price_paid,
    status: "saved",
    purchased_at: new Date().toISOString().split("T")[0],
    recipient_name: "Saved from quiz",
  };

  if (image_url) {
    insertPayload.gift_image_url = image_url;
  }

  let { error } = await supabase.from("purchases").insert(insertPayload);

  if (error && (error.message.includes("gift_image_url") || error.code === "42703")) {
    const fallbackPayload = { ...insertPayload };
    delete fallbackPayload.gift_image_url;
    ({ error } = await supabase.from("purchases").insert(fallbackPayload));
  }

  if (error) {
    console.error("Save gift error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/gifts");
  revalidatePath(`/results/${session_id}`);
  redirect(`/dashboard/gifts`);
}

// ── "Email me these picks" (Step 6c) ─────────────────────────────────────
// The v2 quiz no longer asks for an email up front; the shopper opts in here.
// Results links are shareable, so to stop a link being used to fire emails at
// arbitrary addresses, a session can be emailed ONCE: the address is claimed
// with a conditional update (only while email_captured is still empty).

export type EmailPicksResult = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function emailMyPicks(
  sessionId: string, firstName: string, email: string, typoConfirmed = false,
): Promise<EmailPicksResult> {
  const to = (email || "").trim();
  const name = (firstName || "").trim().slice(0, 80);
  if (!UUID.test(sessionId || "")) return { ok: false, error: "We couldn't find these results." };
  if (!looksLikeEmail(to) || to.length > 254) return { ok: false, error: "Please enter a valid email address." };
  // A known domain typo (gmail.col) bounces — never send it unless the
  // shopper explicitly said "keep it" (the form asks first).
  const fix = suggestEmailFix(to);
  if (fix && !typoConfirmed) return { ok: false, error: `Did you mean ${fix}?` };

  const db = createServiceClient();
  const { data: claimed, error } = await db
    .from("quiz_sessions")
    .update({ email_captured: to, first_name_captured: name || null })
    .eq("id", sessionId)
    .is("email_captured", null)
    .select("id, answers");
  if (error) {
    console.error("[email-picks] claim failed:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (!claimed || claimed.length === 0) return { ok: false, error: "These picks have already been emailed." };

  const picks = await loadSessionPicks(db, sessionId);
  // Greeting (owner rule): the shopper's name if typed, else the gift recipient's.
  const recipientName = String(claimed[0]?.answers?.recipientName || "").trim();
  const greetName = name || recipientName || undefined;
  const sent = picks.length > 0 && (await sendResultsEmail({ to, firstName: greetName, recommendations: picks, sessionId }));
  if (!sent) {
    // Release the claim so the shopper can retry.
    await db.from("quiz_sessions").update({ email_captured: null, first_name_captured: null }).eq("id", sessionId).eq("email_captured", to);
    return { ok: false, error: "We couldn't send the email. Please try again." };
  }
  return { ok: true };
}
