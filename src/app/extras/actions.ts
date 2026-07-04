"use server";

import { createServiceClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { PRICES_CENTS, isServiceType, ASSET_BUCKET, extrasEnabled } from "@/lib/extras";
import { sendOrderConfirmation, sendAdminOrderAlert } from "@/lib/order-emails";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";

// Lets an (anonymous) buyer upload a reference photo for their card directly
// to Storage via a one-time signed URL. Returns the URL to record on the order.
export async function createBuyerUploadUrl(filename: string) {
  if (!extrasEnabled()) throw new Error("Extras are not available");
  const admin = createServiceClient();
  const ext = (filename.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `buyer-uploads/${randomUUID()}.${ext}`;
  const { data, error } = await admin.storage.from(ASSET_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message || "Could not start the upload");
  const { data: pub } = admin.storage.from(ASSET_BUCKET).getPublicUrl(path);
  return { path: data.path, token: data.token, publicUrl: pub.publicUrl };
}

// Payment is not wired yet (UI-first). While false, we simulate a successful
// payment by marking the order "paid" immediately. When Stripe is added, set
// this true and the Stripe webhook becomes what flips an order to "paid".
const PAYMENTS_ENABLED = false;

export async function createOrder(formData: FormData) {
  if (!extrasEnabled()) throw new Error("Extras are not available");
  const service_type = (formData.get("service_type") as string) || "";
  if (!isServiceType(service_type)) throw new Error("Unknown service");

  const buyer_email = ((formData.get("buyer_email") as string) || "").trim();
  const buyer_name = ((formData.get("buyer_name") as string) || "").trim() || null;
  const occasion = ((formData.get("occasion") as string) || "").trim() || null;
  const recipient_name = ((formData.get("recipient_name") as string) || "").trim() || null;
  const card_message = ((formData.get("card_message") as string) || "").trim() || null;
  const song_details = ((formData.get("song_details") as string) || "").trim() || null;
  const reference_photos = (formData.getAll("reference_photos") as string[]).filter(Boolean);

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
      reference_photos: reference_photos.length ? reference_photos : null,
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
