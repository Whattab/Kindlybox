import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { createServiceClient } from "@/utils/supabase/admin";
import { SERVICES, isServiceType } from "@/lib/extras";

export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: { order?: string };
}) {
  const orderId = searchParams.order;
  let serviceName = "your order";
  let email: string | null = null;

  if (orderId) {
    const admin = createServiceClient();
    const { data: order } = await admin
      .from("orders")
      .select("service_type, buyer_email")
      .eq("id", orderId)
      .maybeSingle();
    if (order) {
      email = order.buyer_email;
      if (isServiceType(order.service_type)) serviceName = SERVICES[order.service_type].name;
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-3xl p-10 shadow-xl shadow-primary/5 border border-gray-100 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-6">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-serif font-bold text-primary mb-3">Order received!</h1>
        <p className="text-gray-600 mb-2">
          Thank you — we&apos;ve got your <span className="font-semibold text-primary">{serviceName}</span> brief.
        </p>
        <p className="text-gray-600 mb-8">
          We&apos;ll craft it and email the finished piece{email ? <> to <span className="font-semibold">{email}</span></> : ""}, usually within 1–2 days.
        </p>

        <div className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 mb-8">
          Preview mode: online payment isn&apos;t live yet, so this order was logged without charging. Once payment is enabled, you&apos;ll check out securely before this step.
        </div>

        <Link href="/" className="inline-flex items-center justify-center rounded-xl bg-primary text-white px-6 py-3 text-sm font-semibold hover:bg-primary/90 transition-colors">
          Back to home
        </Link>
      </div>
    </main>
  );
}
