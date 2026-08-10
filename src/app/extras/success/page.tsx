import Link from "next/link";
import { CheckCircle2, Loader2, Clock, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { createServiceClient } from "@/utils/supabase/admin";
import { SERVICES, isServiceType, DELIVERY_OPTIONS, CARD_DELIVERY_OPTIONS } from "@/lib/extras";
import { PendingRefresh } from "./PendingRefresh";

export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: { order?: string };
}) {
  const orderId = searchParams.order;
  type OrderRow = {
    service_type: string;
    buyer_email: string | null;
    status: string;
    recipient_name: string | null;
    occasion: string | null;
    brief: Record<string, string> | null;
  };
  let order: OrderRow | null = null;

  if (orderId) {
    const admin = createServiceClient();
    const { data } = await admin
      .from("orders")
      .select("service_type, buyer_email, status, recipient_name, occasion, brief")
      .eq("id", orderId)
      .maybeSingle();
    order = (data as OrderRow | null) ?? null;
  }

  const status = order?.status ?? null;
  const email = order?.buyer_email ?? null;
  const serviceType = order?.service_type ?? null;
  // The webhook flips the order to paid and can land a moment after Stripe
  // sends the buyer back here. Until then, show a settling state.
  const awaitingWebhook = status === "pending_payment";

  // ── Bundle: combined "Step 10 of 10" confirmation ──
  if (serviceType === "bundle") {
    const brief = order?.brief ?? {};
    const forLine = [order?.recipient_name, order?.occasion].filter(Boolean).join(" · ");
    const songStyle = [brief.genre, brief.mood].filter(Boolean).join(" · ");

    return (
      <main className="min-h-screen bg-gradient-to-b from-[#2b211a] via-[#221912] to-[#150f0a] text-[#f2e9db]">
        <div className="max-w-md mx-auto px-5 pt-6 pb-32">
          <div className="flex gap-1 rounded-full bg-[#2a201a] p-1 border border-[#3d3128] mb-7">
            {["Song", "Card", "Bundle"].map((t) => (
              <span key={t} className={`flex-1 text-center rounded-full py-2.5 text-sm ${t === "Bundle" ? "font-bold bg-[#D9A93E] text-[#1a120d]" : "font-semibold text-[#6b5a49]"}`}>{t}</span>
            ))}
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-11 h-11 rounded-full border border-[#4a3d33] flex items-center justify-center text-[#6b5a49]"><ChevronLeft className="w-5 h-5" /></div>
            <span className="text-sm font-bold tracking-[0.15em] text-[#b6a898]">STEP 10 OF 10</span>
          </div>

          <div className="h-1.5 w-full rounded-full bg-[#3a2e25] overflow-hidden mb-8">
            <div className="h-full rounded-full bg-gradient-to-r from-[#c0392b] via-[#e07b39] to-[#D9A93E]" style={{ width: "100%" }} />
          </div>

          <h1 className="text-4xl font-serif font-bold mb-6">{awaitingWebhook ? "Almost there…" : "Your gift bundle is on its way"}</h1>
          {awaitingWebhook && <PendingRefresh />}

          <div className="rounded-3xl bg-[#F3ECDD] text-[#2a1f18] p-7 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#D9A93E] mb-5">
              {awaitingWebhook ? <Loader2 className="w-8 h-8 text-[#1a120d] animate-spin" /> : <Check className="w-9 h-9 text-[#1a120d]" strokeWidth={3} />}
            </div>
            <h2 className="text-2xl font-serif font-bold mb-2">{awaitingWebhook ? "Confirming your payment…" : "We're creating it now"}</h2>
            <p className="text-[#6b5d4c] mb-5">
              {awaitingWebhook ? "This usually takes a few seconds — you can safely close this page." : "Your card and custom song are both designed individually, so they're worth the short wait."}
            </p>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#f3dfe0] text-[#a83a52] font-semibold px-4 py-2 text-sm">📬 Arrives within 2 days</span>

            <div className="border-t border-dashed border-[#c9bca7] my-6" />

            <dl className="space-y-2.5 text-left">
              {forLine && (
                <div className="flex justify-between gap-4"><dt className="text-[#8a7c68]">For</dt><dd className="font-bold text-right">{forLine}</dd></div>
              )}
              {brief.design && (
                <div className="flex justify-between gap-4"><dt className="text-[#8a7c68]">Card style</dt><dd className="font-bold text-right">{brief.design}</dd></div>
              )}
              {songStyle && (
                <div className="flex justify-between gap-4"><dt className="text-[#8a7c68]">Song style</dt><dd className="font-bold text-right">{songStyle}</dd></div>
              )}
            </dl>
          </div>

          <div className="mt-5 rounded-2xl border border-[#3d3128] text-[#b6a898] text-sm px-5 py-4">
            We&apos;ll email you{email ? <> at <span className="font-semibold text-[#e3d7c7]">{email}</span></> : ""} as soon as your bundle is ready — usually within 2 days. Your first revision is free if it&apos;s not quite right.
          </div>
        </div>

        <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#150f0a] via-[#150f0a] to-transparent pt-8 pb-6 px-5">
          <div className="max-w-md mx-auto">
            <Link href="/" className="w-full rounded-full bg-[#D9A93E] text-[#1a120d] font-bold py-4 inline-flex items-center justify-center gap-2 hover:bg-[#e5b74f] transition-colors">Done <ChevronRight className="w-5 h-5" /></Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Song / Card: the dark "Step 6 of 6" confirmation ──
  if (serviceType === "song" || serviceType === "card") {
    const isCard = serviceType === "card";
    const brief = order?.brief ?? {};
    const activeTab = isCard ? "Card" : "Song";
    const headline = isCard ? "Your card is on its way" : "Your song is on its way";
    const eta = isCard ? "1 day" : "2 days";
    const creatingLine = isCard
      ? "We're designing the final card in your chosen style and will email it within a day."
      : "Every song is written and produced individually, so it's worth the wait.";
    const styleLabel = isCard ? "Design" : "Style";
    const styleValue = isCard ? brief.design : [brief.genre, brief.mood].filter(Boolean).join(" · ");
    const deliveryLabel = isCard
      ? CARD_DELIVERY_OPTIONS.find((d) => d.id === brief.delivery)?.label ?? brief.delivery
      : DELIVERY_OPTIONS.find((d) => d.id === brief.delivery)?.label ?? brief.delivery;
    const forLine = [order?.recipient_name, order?.occasion].filter(Boolean).join(" · ");

    return (
      <main className="min-h-screen bg-gradient-to-b from-[#2b211a] via-[#221912] to-[#150f0a] text-[#f2e9db]">
        <div className="max-w-md mx-auto px-5 pt-6 pb-32">
          {/* Service tabs (non-interactive on the confirmation) */}
          <div className="flex gap-1 rounded-full bg-[#2a201a] p-1 border border-[#3d3128] mb-7">
            {["Song", "Card", "Bundle"].map((t) => (
              <span
                key={t}
                className={`flex-1 text-center rounded-full py-2.5 text-sm ${
                  t === activeTab ? "font-bold bg-[#D9A93E] text-[#1a120d]" : "font-semibold text-[#6b5a49]"
                }`}
              >
                {t}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-11 h-11 rounded-full border border-[#4a3d33] flex items-center justify-center text-[#6b5a49]">
              <ChevronLeft className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold tracking-[0.15em] text-[#b6a898]">STEP 6 OF 6</span>
          </div>

          <div className="h-1.5 w-full rounded-full bg-[#3a2e25] overflow-hidden mb-8">
            <div className="h-full rounded-full bg-gradient-to-r from-[#c0392b] via-[#e07b39] to-[#D9A93E]" style={{ width: "100%" }} />
          </div>

          <h1 className="text-4xl font-serif font-bold mb-6">{awaitingWebhook ? "Almost there…" : headline}</h1>

          {awaitingWebhook && <PendingRefresh />}

          <div className="rounded-3xl bg-[#F3ECDD] text-[#2a1f18] p-7 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#D9A93E] mb-5">
              {awaitingWebhook ? (
                <Loader2 className="w-8 h-8 text-[#1a120d] animate-spin" />
              ) : (
                <Clock className="w-8 h-8 text-[#1a120d]" />
              )}
            </div>
            <h2 className="text-2xl font-serif font-bold mb-2">
              {awaitingWebhook ? "Confirming your payment…" : "We're on it"}
            </h2>
            <p className="text-[#6b5d4c] mb-5">
              {awaitingWebhook ? "This usually takes a few seconds — you can safely close this page." : creatingLine}
            </p>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#f3dfe0] text-[#a83a52] font-semibold px-4 py-2 text-sm">
              📬 Arrives within {eta}
            </span>

            <div className="border-t border-dashed border-[#c9bca7] my-6" />

            <dl className="space-y-2.5 text-left">
              {forLine && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[#8a7c68]">For</dt>
                  <dd className="font-bold text-right">{forLine}</dd>
                </div>
              )}
              {styleValue && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[#8a7c68]">{styleLabel}</dt>
                  <dd className="font-bold text-right">{styleValue}</dd>
                </div>
              )}
              {deliveryLabel && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[#8a7c68]">Delivery</dt>
                  <dd className="font-bold text-right">{deliveryLabel}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="mt-5 rounded-2xl border border-[#3d3128] text-[#b6a898] text-sm px-5 py-4">
            We&apos;ll email you{email ? <> at <span className="font-semibold text-[#e3d7c7]">{email}</span></> : ""} the
            moment it&apos;s ready. Your first revision is free if it&apos;s not quite right.
          </div>
        </div>

        <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#150f0a] via-[#150f0a] to-transparent pt-8 pb-6 px-5">
          <div className="max-w-md mx-auto">
            <Link
              href="/"
              className="w-full rounded-full bg-[#D9A93E] text-[#1a120d] font-bold py-4 inline-flex items-center justify-center gap-2 hover:bg-[#e5b74f] transition-colors"
            >
              Done <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Card / Bundle: existing light confirmation ──
  const serviceName = serviceType && isServiceType(serviceType) ? SERVICES[serviceType].name : "your order";

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
