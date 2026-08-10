"use server";

import { createServiceClient } from "@/utils/supabase/admin";
import { assertAdmin } from "@/utils/admin";
import { SERVICES, isServiceType, ASSET_BUCKET } from "@/lib/extras";
import { sendOrderDelivery } from "@/lib/order-emails";
import { revalidatePath } from "next/cache";

export async function updateOrder(id: string, formData: FormData) {
  await assertAdmin();
  const admin = createServiceClient();

  const status = (formData.get("status") as string) || undefined;
  const admin_notes = ((formData.get("admin_notes") as string) || "").trim() || null;

  const { error } = await admin
    .from("orders")
    .update({ status, admin_notes })
    .eq("id", id);

  if (error) {
    console.error("Update order error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
}

export async function archiveOrder(id: string, archived: boolean) {
  await assertAdmin();
  const admin = createServiceClient();
  const { error } = await admin.from("orders").update({ archived }).eq("id", id);
  if (error) {
    console.error("Archive order error:", error);
    throw new Error(error.message);
  }
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
}

export async function deleteOrder(id: string) {
  await assertAdmin();
  const admin = createServiceClient();

  // Best-effort: remove the order's uploaded files so storage isn't orphaned.
  try {
    const { data: files } = await admin.storage.from(ASSET_BUCKET).list(id);
    if (files && files.length > 0) {
      await admin.storage.from(ASSET_BUCKET).remove(files.map((f) => `${id}/${f.name}`));
    }
  } catch (e) {
    console.error("[deleteOrder] storage cleanup failed (continuing):", e);
  }

  const { error } = await admin.from("orders").delete().eq("id", id);
  if (error) {
    console.error("Delete order error:", error);
    throw new Error(error.message);
  }
  revalidatePath("/dashboard/orders");
}

// Step 1 of an asset upload: mint a one-time signed URL the browser uploads
// the file directly to (so big audio/video files never pass through the server).
export async function createAssetUploadUrl(orderId: string, type: "song" | "card", filename: string) {
  await assertAdmin();
  const admin = createServiceClient();
  const ext = (filename.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${orderId}/${type}-${Date.now()}.${ext}`;
  const { data, error } = await admin.storage.from(ASSET_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message || "Could not start the upload");
  return { path: data.path, token: data.token };
}

// Step 2: after the browser finishes uploading, record the file's URL on the order.
export async function saveAssetUrl(orderId: string, type: "song" | "card", path: string) {
  await assertAdmin();
  const admin = createServiceClient();
  const { data } = admin.storage.from(ASSET_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;
  const column = type === "song" ? "song_url" : "card_url";

  const { error } = await admin.from("orders").update({ [column]: publicUrl }).eq("id", orderId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/orders");
  return publicUrl;
}

// Delete a single uploaded asset (song or card) from an order without touching
// the order itself — removes the file(s) from storage and clears the URL column,
// so the admin can re-upload or leave it empty.
export async function deleteAsset(orderId: string, type: "song" | "card") {
  await assertAdmin();
  const admin = createServiceClient();
  const column = type === "song" ? "song_url" : "card_url";

  // Files are stored as `${orderId}/${type}-<timestamp>.<ext>` — remove that type.
  try {
    const { data: files } = await admin.storage.from(ASSET_BUCKET).list(orderId);
    const toRemove = (files ?? [])
      .filter((f) => f.name.startsWith(`${type}-`))
      .map((f) => `${orderId}/${f.name}`);
    if (toRemove.length) await admin.storage.from(ASSET_BUCKET).remove(toRemove);
  } catch (e) {
    console.error("[deleteAsset] storage cleanup failed (continuing):", e);
  }

  const { error } = await admin.from("orders").update({ [column]: null }).eq("id", orderId);
  if (error) {
    console.error("Delete asset error:", error);
    throw new Error(error.message);
  }
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/orders");
}

export async function deliverOrder(id: string) {
  await assertAdmin();
  const admin = createServiceClient();

  const { data: order, error: fetchErr } = await admin
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !order) throw new Error("Order not found");
  const serviceType: string = order.service_type;
  if (!isServiceType(serviceType)) throw new Error("Unknown service type");

  // Make sure the required asset(s) are attached before delivering.
  const svc = SERVICES[serviceType];
  if (svc.needsSongDetails && !order.song_url) throw new Error("Upload the song file before delivering");
  if (svc.needsCardMessage && !order.card_url) throw new Error("Upload the card file before delivering");

  // Send the email FIRST — only mark the order delivered if it actually goes out.
  try {
    await sendOrderDelivery({
      id: order.id,
      buyer_email: order.buyer_email,
      buyer_name: order.buyer_name,
      service_type: order.service_type,
      song_url: order.song_url,
      card_url: order.card_url,
    });
  } catch (e: any) {
    console.error("[order-emails] delivery send failed:", e);
    throw new Error(`Delivery email failed to send, so the order was NOT marked delivered. ${e?.message || ""}`);
  }

  const deliveredAt = new Date().toISOString();
  const { error } = await admin
    .from("orders")
    .update({ status: "delivered", delivered_at: deliveredAt })
    .eq("id", id);

  if (error) {
    console.error("Deliver order error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
}
