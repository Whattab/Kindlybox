import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";
import { SERVICES, formatPrice, isServiceType } from "@/lib/extras";
import { Music, Mail as MailIcon, Sparkles, ShoppingBag, Download, Clock, CheckCircle2, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const SERVICE_ICON: Record<string, any> = { song: Music, card: MailIcon, bundle: Sparkles };

export default async function MyOrdersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Orders are RLS-locked, so read them with the service client but scope
  // strictly to THIS user — by account id or the email they ordered with.
  const admin = createServiceClient();
  const { data: orders } = await admin
    .from("orders")
    .select("id, created_at, service_type, occasion, recipient_name, price_cents, currency, status, song_url, card_url")
    .or(`user_id.eq.${user.id},buyer_email.ilike.${user.email}`)
    .order("created_at", { ascending: false });

  const list = orders ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
          <ShoppingBag className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">My Orders</h1>
          <p className="text-gray-500 mt-0.5">Your custom songs &amp; greeting cards.</p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
          <p className="text-gray-500 mb-4">You haven&apos;t ordered anything yet.</p>
          <Link href="/extras" className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-5 py-2.5 text-sm font-semibold hover:bg-primary/90">
            Order a custom song or card <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((o) => {
            const svc = isServiceType(o.service_type) ? SERVICES[o.service_type] : null;
            const Icon = SERVICE_ICON[o.service_type] || ShoppingBag;
            const isDelivered = o.status === "delivered";
            return (
              <div key={o.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{svc?.name || o.service_type}</p>
                      <p className="text-sm text-gray-400">
                        {o.occasion ? <span className="capitalize">{o.occasion}</span> : null}
                        {o.recipient_name ? ` · for ${o.recipient_name}` : ""}
                        {" · "}{new Date(o.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {isDelivered ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 flex-shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 flex-shrink-0">
                      <Clock className="w-3.5 h-3.5" /> In progress
                    </span>
                  )}
                </div>

                {isDelivered ? (
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-50">
                    {o.song_url && (
                      <a href={`${o.song_url}?download`} className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-4 py-2 text-sm font-semibold hover:bg-primary/90">
                        <Download className="w-4 h-4" /> Download song
                      </a>
                    )}
                    {o.card_url && (
                      <a href={`${o.card_url}?download`} className="inline-flex items-center gap-2 rounded-xl bg-accent text-white px-4 py-2 text-sm font-semibold hover:bg-accent/90">
                        <Download className="w-4 h-4" /> Download card
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 pt-3 border-t border-gray-50">
                    We&apos;re crafting this now — you&apos;ll be able to download it here as soon as it&apos;s ready.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
