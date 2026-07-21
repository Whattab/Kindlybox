// Stripe webhook — the single source of truth for "payment succeeded".
// Stripe calls this after a Checkout session completes; we verify the
// signature, flip the order to "paid", and send the confirmation + admin
// alert emails. Configure the endpoint in the Stripe dashboard (prod) or via
// `stripe listen --forward-to .../api/webhooks/stripe` (local).

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/utils/supabase/admin";
import { sendOrderConfirmation, sendAdminOrderAlert } from "@/lib/order-emails";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = request.headers.get("stripe-signature");
  if (!secret || !sig) {
    return new NextResponse("Missing webhook secret or signature", { status: 400 });
  }

  // Verify the event is genuinely from Stripe using the raw body.
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err: any) {
    console.error("[stripe webhook] signature verification failed:", err?.message);
    return new NextResponse(`Webhook Error: ${err?.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = (session.metadata?.order_id as string) || (session.client_reference_id as string);

    if (orderId) {
      const admin = createServiceClient();
      // Only the first transition from pending_payment returns a row — this
      // makes duplicate Stripe events idempotent (no double emails).
      const { data: order } = await admin
        .from("orders")
        .update({
          status: "paid",
          stripe_payment_intent: (session.payment_intent as string) ?? null,
        })
        .eq("id", orderId)
        .eq("status", "pending_payment")
        .select("*")
        .maybeSingle();

      if (order) {
        try {
          await Promise.all([
            sendOrderConfirmation({
              id: order.id,
              buyer_email: order.buyer_email,
              buyer_name: order.buyer_name,
              service_type: order.service_type,
              occasion: order.occasion,
            }),
            sendAdminOrderAlert({
              id: order.id,
              service_type: order.service_type,
              occasion: order.occasion,
              buyer_email: order.buyer_email,
            }),
          ]);
        } catch (e) {
          console.error("[stripe webhook] order emails failed:", e);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
