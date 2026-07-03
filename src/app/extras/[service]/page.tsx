import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { SERVICES, PRICES_CENTS, formatPrice, OCCASIONS, isServiceType } from "@/lib/extras";
import { createOrder } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export default function OrderBriefPage({ params }: { params: { service: string } }) {
  if (!isServiceType(params.service)) return notFound();
  const svc = SERVICES[params.service];

  const inputClass = "w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";

  return (
    <main className="min-h-screen bg-background">
      <header className="px-6 py-4 border-b border-primary/5 bg-white shadow-sm">
        <Link href="/extras" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-accent">
          <ArrowLeft className="w-4 h-4" /> All extras
        </Link>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold text-primary">{svc.name}</h1>
          <p className="text-gray-500 mt-1">{svc.tagline} · <span className="font-semibold text-primary">{formatPrice(PRICES_CENTS[svc.type])}</span></p>
        </div>

        <form action={createOrder} className="bg-white rounded-3xl p-8 shadow-xl shadow-primary/5 border border-gray-100 space-y-6">
          <input type="hidden" name="service_type" value={svc.type} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Occasion</label>
              <select name="occasion" defaultValue="" className={`${inputClass} bg-white`}>
                <option value="" disabled>Choose…</option>
                {OCCASIONS.map((o) => <option key={o} value={o} className="capitalize">{o}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Who is it for?</label>
              <input type="text" name="recipient_name" className={inputClass} placeholder="Their name" />
            </div>
          </div>

          {svc.needsCardMessage && (
            <div>
              <label className={labelClass}>Your card message *</label>
              <textarea name="card_message" rows={4} required className={inputClass} placeholder="Write the exact words you want on the card…" />
              <p className="text-xs text-gray-400 mt-1">We&apos;ll print your words exactly as written.</p>
            </div>
          )}

          {svc.needsSongDetails && (
            <div>
              <label className={labelClass}>Song details *</label>
              <textarea name="song_details" rows={5} required className={inputClass} placeholder="Style/genre (e.g. acoustic pop), mood, names to include, and the story or memories you want in the song…" />
              <p className="text-xs text-gray-400 mt-1">The more detail, the more personal the song.</p>
            </div>
          )}

          <div className="pt-2 border-t border-gray-100">
            <label className={labelClass}>Your email (for delivery) *</label>
            <input type="email" name="buyer_email" required className={inputClass} placeholder="you@email.com" />
            <div className="mt-2">
              <label className={labelClass}>Your name</label>
              <input type="text" name="buyer_name" className={inputClass} placeholder="Optional" />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Secure checkout
            </p>
            <SubmitButton pendingText="Processing…" className="bg-accent hover:bg-accent/90 px-8">
              Continue · {formatPrice(PRICES_CENTS[svc.type])}
            </SubmitButton>
          </div>
        </form>
      </div>
    </main>
  );
}
