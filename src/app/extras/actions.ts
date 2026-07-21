"use server";

import { createServiceClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { PRICES_CENTS, SERVICES, isServiceType, ASSET_BUCKET, extrasEnabled } from "@/lib/extras";
import { getStripe } from "@/lib/stripe";
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
  const svc = SERVICES[service_type];

  // Link to a logged-in account if there is one (optional).
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Create the order as pending_payment. The Stripe webhook flips it to
  //    "paid" (and sends the emails) only after payment actually succeeds.
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
      status: "pending_payment",
    })
    .select("id")
    .single();

  if (error || !order) {
    console.error("Create order error:", error);
    throw new Error(error?.message || "Could not create the order");
  }

  // 2. Create a hosted Stripe Checkout session for this order.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kindlybox.com";
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: buyer_email,
    client_reference_id: order.id,
    metadata: { order_id: order.id },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: price_cents,
          product_data: {
            name: `KindlyBox — ${svc.name}`,
            ...(occasion ? { description: `For a ${occasion}` } : {}),
          },
        },
      },
    ],
    success_url: `${appUrl}/extras/success?order=${order.id}`,
    cancel_url: `${appUrl}/extras/${service_type}`,
  });

  await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

  if (!session.url) throw new Error("Could not start checkout");
  redirect(session.url); // off to Stripe's hosted payment page
}
