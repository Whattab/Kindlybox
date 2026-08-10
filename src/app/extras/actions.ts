"use server";

import { createServiceClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { PRICES_CENTS, SERVICES, isServiceType, ASSET_BUCKET, extrasEnabled, type ServiceType } from "@/lib/extras";
import { getStripe } from "@/lib/stripe";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

interface OrderInput {
  service_type: ServiceType;
  buyer_email: string | null; // null → let Stripe collect it; webhook backfills
  buyer_name: string | null;
  occasion: string | null;
  recipient_name: string | null;
  card_message: string | null;
  song_details: string | null;
  brief: Record<string, unknown> | null;
  reference_photos: string[];
}

// Shared core: create the order as pending_payment, open a Stripe Checkout
// session, and return its hosted-payment URL. The webhook flips the order to
// "paid" (and sends the emails) only after payment actually succeeds.
async function createOrderCheckoutUrl(input: OrderInput): Promise<string> {
  if (!extrasEnabled()) throw new Error("Extras are not available");

  const price_cents = PRICES_CENTS[input.service_type];
  const svc = SERVICES[input.service_type];

  // Link to a logged-in account if there is one, and use its email as a fallback.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const buyer_email = input.buyer_email || user?.email || null;

  const admin = createServiceClient();
  const { data: order, error } = await admin
    .from("orders")
    .insert({
      user_id: user?.id ?? null,
      buyer_email,
      buyer_name: input.buyer_name,
      service_type: input.service_type,
      occasion: input.occasion,
      recipient_name: input.recipient_name,
      card_message: input.card_message,
      song_details: input.song_details,
      brief: input.brief,
      reference_photos: input.reference_photos.length ? input.reference_photos : null,
      price_cents,
      status: "pending_payment",
    })
    .select("id")
    .single();

  if (error || !order) {
    console.error("Create order error:", error);
    throw new Error(error?.message || "Could not create the order");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kindlybox.com";
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    // With no email, Stripe Checkout collects it on the hosted page.
    ...(buyer_email ? { customer_email: buyer_email } : {}),
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
            ...(input.occasion ? { description: `For a ${input.occasion}` } : {}),
          },
        },
      },
    ],
    success_url: `${appUrl}/extras/success?order=${order.id}`,
    cancel_url: `${appUrl}/extras/${input.service_type}`,
  });

  await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
  if (!session.url) throw new Error("Could not start checkout");
  return session.url;
}

// Old single-page card/bundle form posts here (form action → redirect).
export async function createOrder(formData: FormData) {
  const service_type = (formData.get("service_type") as string) || "";
  if (!isServiceType(service_type)) throw new Error("Unknown service");

  const buyer_email = ((formData.get("buyer_email") as string) || "").trim();
  if (!buyer_email) throw new Error("Your email is required so we can deliver the order");

  const url = await createOrderCheckoutUrl({
    service_type,
    buyer_email,
    buyer_name: ((formData.get("buyer_name") as string) || "").trim() || null,
    occasion: ((formData.get("occasion") as string) || "").trim() || null,
    recipient_name: ((formData.get("recipient_name") as string) || "").trim() || null,
    card_message: ((formData.get("card_message") as string) || "").trim() || null,
    song_details: ((formData.get("song_details") as string) || "").trim() || null,
    brief: null,
    reference_photos: (formData.getAll("reference_photos") as string[]).filter(Boolean),
  });
  redirect(url); // off to Stripe's hosted payment page
}

// New custom-song wizard (client-driven). Returns the checkout URL so the
// client can redirect itself — this keeps inline error handling clean and
// avoids swallowing Next's redirect signal inside a try/catch.
export async function startSongCheckout(formData: FormData): Promise<{ url?: string; error?: string }> {
  try {
    const brief = JSON.parse((formData.get("brief") as string) || "{}") as Record<string, string>;
    const occasion = ((formData.get("occasion") as string) || "").trim() || null;
    const recipient_name = ((formData.get("recipient_name") as string) || "").trim() || null;

    // A readable summary for the admin order view; structured data lives in brief.
    const song_details = [
      brief.genre && brief.mood ? `${brief.genre} · ${brief.mood}` : "",
      brief.story ? `Story: ${brief.story}` : "",
      brief.namesToInclude ? `Include: ${brief.namesToInclude}` : "",
      brief.signature ? `From: ${brief.signature}` : "",
      brief.delivery ? `Delivery: ${brief.delivery}` : "",
    ].filter(Boolean).join("\n");

    const url = await createOrderCheckoutUrl({
      service_type: "song",
      buyer_email: null,
      buyer_name: null,
      occasion,
      recipient_name,
      card_message: null,
      song_details: song_details || null,
      brief,
      reference_photos: [],
    });
    return { url };
  } catch (e: any) {
    console.error("startSongCheckout error:", e);
    return { error: e?.message || "Could not start checkout" };
  }
}

// Greeting-card wizard checkout. Stores the card brief (design, message,
// names, sign-off, photo, delivery) and mirrors the message into card_message
// for the admin order view.
export async function startCardCheckout(formData: FormData): Promise<{ url?: string; error?: string }> {
  try {
    const brief = JSON.parse((formData.get("brief") as string) || "{}") as Record<string, string>;
    const occasion = ((formData.get("occasion") as string) || "").trim() || null;
    const recipient_name = ((formData.get("recipient_name") as string) || "").trim() || null;
    const photoUrl = (brief.photoUrl || "").trim();

    const url = await createOrderCheckoutUrl({
      service_type: "card",
      buyer_email: null,
      buyer_name: null,
      occasion,
      recipient_name,
      card_message: brief.message || null,
      song_details: null,
      brief,
      reference_photos: photoUrl ? [photoUrl] : [],
    });
    return { url };
  } catch (e: any) {
    console.error("startCardCheckout error:", e);
    return { error: e?.message || "Could not start checkout" };
  }
}

// Song + Card bundle wizard checkout. Stores both the song and card fields in
// one brief and mirrors the card message + a song summary for the admin view.
export async function startBundleCheckout(formData: FormData): Promise<{ url?: string; error?: string }> {
  try {
    const brief = JSON.parse((formData.get("brief") as string) || "{}") as Record<string, string>;
    const occasion = ((formData.get("occasion") as string) || "").trim() || null;
    const recipient_name = ((formData.get("recipient_name") as string) || "").trim() || null;
    const photoUrl = (brief.photoUrl || "").trim();

    const song_details = [
      brief.genre && brief.mood ? `${brief.genre} · ${brief.mood}` : "",
      brief.story ? `Story: ${brief.story}` : "",
      brief.songNames ? `Song include: ${brief.songNames}` : "",
      brief.songSignature ? `Song from: ${brief.songSignature}` : "",
      brief.delivery ? `Delivery: ${brief.delivery}` : "",
    ].filter(Boolean).join("\n");

    const url = await createOrderCheckoutUrl({
      service_type: "bundle",
      buyer_email: null,
      buyer_name: null,
      occasion,
      recipient_name,
      card_message: brief.message || null,
      song_details: song_details || null,
      brief,
      reference_photos: photoUrl ? [photoUrl] : [],
    });
    return { url };
  } catch (e: any) {
    console.error("startBundleCheckout error:", e);
    return { error: e?.message || "Could not start checkout" };
  }
}

// "Help me write it" — a few occasion-aware starter messages for the card.
// Fails soft: returns [] so the wizard just doesn't show suggestions.
export async function generateCardDrafts(occasion: string, recipientName: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      // thinkingBudget 0 so short outputs aren't truncated (see personalize.ts).
      generationConfig: { temperature: 0.9, maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } } as any,
    });
    const who = recipientName?.trim() ? ` for ${recipientName.trim()}` : "";
    const prompt = [
      `Write 3 short greeting-card message options for a ${occasion || "special"} card${who}.`,
      "Each option: 1-2 sentences, warm and specific to the occasion, ready to use as-is.",
      "Vary the tone across the three (one heartfelt, one light/funny, one simple and sincere).",
      "No emoji. Do not number or label them. Return each option on its own line, nothing else.",
    ].join("\n");
    const text = (await model.generateContent(prompt)).response.text().trim();
    return text
      .split("\n")
      .map((l) => l.replace(/^["'\-\d.\s]+/, "").replace(/["']$/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
  } catch (e) {
    console.error("generateCardDrafts error:", e);
    return [];
  }
}
