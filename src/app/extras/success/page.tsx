import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { createServiceClient } from "@/utils/supabase/admin";
import { SERVICES, isServiceType } from "@/lib/extras";
import { PendingRefresh } from "./PendingRefresh";

export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: { order?: string };
}) {
  const orderId = searchParams.order;
  let serviceName = "your order";
  let email: string | null = null;
  let status: string | null = null;

  if (orderId) {
    const admin = createServiceClient();
    const { data: order } = await admin
      .from("orders")
      .select("service_type, buyer_email, status")
      .eq("id", orderId)
      .maybeSingle();
    if (order) {
      email = order.buyer_email;
      status = order.status;
      if (isServiceType(order.service_type)) serviceName = SERVICES[order.service_type].name;
    }
  }

  // The webhook is what marks an order paid, and it can land a moment after
  // Stripe sends the buyer back here. Until then, show a settling state.
  const awaitingWebhook = status === "pending_payment";

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-3xl p-10 shadow-xl shadow-primary/5 border border-gray-100 text-center">
        {awaitingWebhook ? (
          <>
            <PendingRefresh />
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mb-6">
              <Loader2 className="w-9 h-9 text-amber-600 animate-spin" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-primary mb-3">Confirming your payment…</h1>
            <p className="text-gray-600 mb-8">
              This usually takes a few seconds. You can safely close this page — we&apos;ll
              email {email ? <span className="font-semibold">{email}</span> : "you"} as soon as
              it&apos;s confirmed.
            </p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-6">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-primary mb-3">Payment received!</h1>
            <p className="text-gray-600 mb-2">
              Thank you — we&apos;ve got your{" "}
              <span className="font-semibold text-primary">{serviceName}</span> brief and a
              receipt is on its way.
            </p>
            <p className="text-gray-600 mb-8">
              We&apos;ll craft it and email the finished piece
              {email ? <> to <span className="font-semibold">{email}</span></> : ""}, usually
              within 1–2 days.
            </p>
          </>
        )}

        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl bg-primary text-white px-6 py-3 text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
