import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/utils/admin";
import { SERVICES, formatPrice, isServiceType } from "@/lib/extras";
import { OrderRowActions } from "./OrderRowActions";
import { ShoppingBag, Music, Mail as MailIcon, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  pending_payment: "text-gray-600 bg-gray-100 border-gray-200",
  paid: "text-blue-700 bg-blue-50 border-blue-200",
  in_progress: "text-amber-700 bg-amber-50 border-amber-200",
  delivered: "text-emerald-700 bg-emerald-50 border-emerald-200",
  cancelled: "text-red-700 bg-red-50 border-red-200",
};
const SERVICE_ICON: Record<string, any> = { song: Music, card: MailIcon, bundle: Sparkles };

export default async function OrdersPage({ searchParams }: { searchParams: { view?: string } }) {
  await requireAdmin();
  const admin = createServiceClient();
  const { data: orders } = await admin
    .from("orders")
    .select("id, created_at, service_type, occasion, recipient_name, buyer_email, price_cents, currency, status, archived")
    .order("created_at", { ascending: false });

  const all = orders ?? [];
  const active = all.filter((o) => !o.archived);
  const archived = all.filter((o) => o.archived);
  const showingArchived = searchParams.view === "archived";
  const list = showingArchived ? archived : active;

  const needsAction = active.filter((o) => o.status === "paid" || o.status === "in_progress").length;
  const delivered = all.filter((o) => o.status === "delivered").length;
  const revenue = all
    .filter((o) => o.status !== "pending_payment" && o.status !== "cancelled")
    .reduce((sum, o) => sum + (o.price_cents || 0), 0);

  const stats = [
    { label: "To fulfill", value: needsAction },
    { label: "Delivered", value: delivered },
    { label: "Revenue", value: formatPrice(revenue) },
  ];

  const tabClass = (activeTab: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
      activeTab ? "bg-primary text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
    }`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
          <ShoppingBag className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">Orders</h1>
          <p className="text-gray-500 mt-0.5">Custom songs &amp; greeting cards to fulfill.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">{s.label}</p>
            <p className="text-3xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Active / Archived toggle */}
      <div className="flex items-center gap-2 mb-4">
        <Link href="/dashboard/orders" className={tabClass(!showingArchived)}>
          Active ({active.length})
        </Link>
        <Link href="/dashboard/orders?view=archived" className={tabClass(showingArchived)}>
          Archived ({archived.length})
        </Link>
      </div>

      <div className="space-y-2">
        {list.map((o) => {
          const svcName = isServiceType(o.service_type) ? SERVICES[o.service_type].name : o.service_type;
          const Icon = SERVICE_ICON[o.service_type] || ShoppingBag;
          return (
            <div
              key={o.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between gap-4 hover:shadow-md transition-shadow"
            >
              <Link href={`/dashboard/orders/${o.id}`} className="flex items-center gap-3 min-w-0 flex-1 group">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4.5 h-4.5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate group-hover:text-accent transition-colors">
                    {svcName}{o.occasion ? <span className="text-gray-400 font-normal"> · {o.occasion}</span> : ""}
                  </p>
                  <p className="text-sm text-gray-400 truncate">
                    {o.recipient_name ? `for ${o.recipient_name} · ` : ""}{o.buyer_email}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="hidden sm:inline text-sm font-semibold text-gray-700">{formatPrice(o.price_cents, o.currency)}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wide border rounded px-1.5 py-0.5 ${STATUS_STYLES[o.status] || "text-gray-600 bg-gray-100 border-gray-200"}`}>
                  {o.status.replace("_", " ")}
                </span>
                <OrderRowActions id={o.id} label={`${svcName} · ${o.buyer_email}`} archived={!!o.archived} />
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <p className="text-gray-400 text-sm py-12 text-center">
            {showingArchived ? "No archived orders." : "No orders yet."}
          </p>
        )}
      </div>
    </div>
  );
}
