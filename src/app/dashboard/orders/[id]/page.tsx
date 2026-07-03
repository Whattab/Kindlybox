import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/utils/admin";
import { SERVICES, formatPrice, isServiceType } from "@/lib/extras";
import { updateOrder } from "../actions";
import { DeliverButton } from "../DeliverButton";
import { AssetUpload } from "../AssetUpload";
import { SubmitButton } from "@/components/SubmitButton";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const inputClass = "w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4";
const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const admin = createServiceClient();
  const { data: order } = await admin.from("orders").select("*").eq("id", params.id).maybeSingle();
  if (!order) return notFound();

  const svc = isServiceType(order.service_type) ? SERVICES[order.service_type] : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/dashboard/orders" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-accent mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">{svc?.name || order.service_type}</h1>
          <p className="text-gray-500 mt-1">
            {formatPrice(order.price_cents, order.currency)} · {order.status.replace("_", " ")} · {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      {/* The brief */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 space-y-4">
        <h2 className="font-bold text-gray-900">The brief</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Occasion" value={order.occasion} />
          <Field label="For" value={order.recipient_name} />
          <Field label="Buyer" value={order.buyer_name} />
          <Field label="Buyer email" value={order.buyer_email} />
        </div>
        {order.card_message && (
          <div>
            <p className={labelClass}>Card message</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-xl p-3 border border-gray-100">{order.card_message}</p>
          </div>
        )}
        {order.song_details && (
          <div>
            <p className={labelClass}>Song details</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-xl p-3 border border-gray-100">{order.song_details}</p>
          </div>
        )}
      </div>

      {/* Fulfillment */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Fulfillment</h2>
          {order.status === "delivered" && order.delivered_at && (
            <span className="text-xs text-emerald-600 font-medium">Delivered {new Date(order.delivered_at).toLocaleDateString()}</span>
          )}
        </div>

        {/* File uploads — each saves on its own as soon as the upload finishes. */}
        <div className="space-y-4 mb-6">
          {svc?.needsSongDetails && (
            <AssetUpload
              orderId={order.id}
              type="song"
              label="Song file"
              hint="Upload the finished audio — MP3 or WAV (max 50MB)."
              accept="audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav"
              currentUrl={order.song_url}
            />
          )}
          {svc?.needsCardMessage && (
            <AssetUpload
              orderId={order.id}
              type="card"
              label="Card file"
              hint="Upload the finished card — an image (JPG/PNG) or video (MP4), max 50MB."
              accept="image/*,video/*"
              currentUrl={order.card_url}
            />
          )}
        </div>

        <form action={updateOrder.bind(null, order.id)} className="space-y-4 pt-4 border-t border-gray-100">
          <div>
            <label className={labelClass}>Status</label>
            <select name="status" defaultValue={order.status} className={`${inputClass} bg-white`}>
              <option value="pending_payment">pending payment</option>
              <option value="paid">paid</option>
              <option value="in_progress">in progress</option>
              <option value="delivered">delivered</option>
              <option value="cancelled">cancelled</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Admin notes</label>
            <textarea name="admin_notes" rows={2} defaultValue={order.admin_notes ?? ""} className={inputClass} placeholder="Private notes (not sent to buyer)." />
          </div>

          <div className="flex items-center justify-between pt-2">
            <SubmitButton pendingText="Saving…" className="bg-primary">Save</SubmitButton>
            <DeliverButton id={order.id} />
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
      <p className="text-gray-800 capitalize break-words">{value || "—"}</p>
    </div>
  );
}
