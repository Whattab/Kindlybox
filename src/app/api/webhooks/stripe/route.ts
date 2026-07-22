// Stripe webhook — the single source of truth for order lifecycle.
// Stripe calls this after a Checkout session resolves; we verify the
// signature, then:
//   - completed + paid  → flip the order to "paid" and send the confirmation
//                          + admin alert emails
//   - expired           → flip an abandoned order to "cancelled" so it doesn't
//                          linger as pending_payment forever
// Configure the endpoint in the Stripe dashboard (prod) or via
// `stripe listen --forward-to .../api/webhooks/stripe` (local). Subscribe to
// checkout.session.completed and checkout.session.expired.

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

    // For cards this is always "paid", but delayed methods (ACH, Klarna, bank
    // transfer) complete the session as "unpaid"/"no_payment_required" while
    // the money is still in flight. Only fulfill once it's genuinely paid —
    // otherwise we'd email "confirmed" and deliver before funds settle.
    // (If a delayed method is ever enabled, also handle
    // checkout.session.async_payment_succeeded / _failed.)
    if (orderId && session.payment_status === "paid") {
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
  } else if (event.type === "checkout.session.expired") {
    // The buyer started checkout but never paid (Stripe expires unfinished
    // sessions after ~24h). Retire the order so it doesn't sit in
    // pending_payment forever. Guard on the current status so we never touch
    // an order that somehow already reached paid.
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = (session.metadata?.order_id as string) || (session.client_reference_id as string);

    if (orderId) {
      const admin = createServiceClient();
      await admin
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", orderId)
        .eq("status", "pending_payment");
    }
  }

  return NextResponse.json({ received: true });
}
