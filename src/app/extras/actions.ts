"use server";

import { createServiceClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { PRICES_CENTS, isServiceType } from "@/lib/extras";
import { sendOrderConfirmation, sendAdminOrderAlert } from "@/lib/order-emails";
import { redirect } from "next/navigation";

// Payment is not wired yet (UI-first). While false, we simulate a successful
// payment by marking the order "paid" immediately. When Stripe is added, set
// this true and the Stripe webhook becomes what flips an order to "paid".
const PAYMENTS_ENABLED = false;

export async function createOrder(formData: FormData) {
  const service_type = (formData.get("service_type") as string) || "";
  if (!isServiceType(service_type)) throw new Error("Unknown service");

  const buyer_email = ((formData.get("buyer_email") as string) || "").trim();
  const buyer_name = ((formData.get("buyer_name") as string) || "").trim() || null;
  const occasion = ((formData.get("occasion") as string) || "").trim() || null;
  const recipient_name = ((formData.get("recipient_name") as string) || "").trim() || null;
  const card_message = ((formData.get("card_message") as string) || "").trim() || null;
  const song_details = ((formData.get("song_details") as string) || "").trim() || null;

  if (!buyer_email) throw new Error("Your email is required so we can deliver the order");

  const price_cents = PRICES_CENTS[service_type];

  // Link to a logged-in account if there is one (optional).
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createServiceClient();
  const { data: order, error } = await admin
    .from("orders")
    .insert({
      user_id: user?.id ?? null,
      buyer_email,
      buyer_name,
      service_type,
      occasion,
      recipient_name,
      card_message,
      song_details,
      price_cents,
      status: PAYMENTS_ENABLED ? "pending_payment" : "paid",
    })
    .select("id")
    .single();

  if (error || !order) {
    console.error("Create order error:", error);
    throw new Error(error?.message || "Could not create the order");
  }

  // Notify the buyer + admin. Never let an email hiccup break the order.
  if (!PAYMENTS_ENABLED) {
    try {
      await Promise.all([
        sendOrderConfirmation({ id: order.id, buyer_email, buyer_name, service_type, occasion }),
        sendAdminOrderAlert({ id: order.id, service_type, occasion, buyer_email }),
      ]);
    } catch (e) {
      console.error("[order-emails] send failed:", e);
    }
  }

  // TODO(stripe): when PAYMENTS_ENABLED, create a Checkout Session here and
  // redirect to its URL instead of going straight to success.
  redirect(`/extras/success?order=${order.id}`);
}
