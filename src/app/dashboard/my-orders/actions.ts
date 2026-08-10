"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/admin";
import { ASSET_BUCKET } from "@/lib/extras";
import { revalidatePath } from "next/cache";

// Let a signed-in customer delete one of THEIR OWN orders. Orders are
// RLS-locked, so we act with the service client but strictly verify ownership
// first (by account id or the email they ordered with) — a user can never
// delete someone else's order.
export async function deleteMyOrder(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in");

  const admin = createServiceClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, user_id, buyer_email")
    .eq("id", id)
    .maybeSingle();
  if (!order) throw new Error("Order not found");

  const ownsByAccount = !!order.user_id && order.user_id === user.id;
  const ownsByEmail =
    !!order.buyer_email && !!user.email && order.buyer_email.toLowerCase() === user.email.toLowerCase();
  if (!ownsByAccount && !ownsByEmail) throw new Error("You can only delete your own orders");

  // Best-effort: remove the order's uploaded files so storage isn't orphaned.
  try {
    const { data: files } = await admin.storage.from(ASSET_BUCKET).list(id);
    if (files && files.length > 0) {
      await admin.storage.from(ASSET_BUCKET).remove(files.map((f) => `${id}/${f.name}`));
    }
  } catch (e) {
    console.error("[deleteMyOrder] storage cleanup failed (continuing):", e);
  }

  const { error } = await admin.from("orders").delete().eq("id", id);
  if (error) {
    console.error("Delete my order error:", error);
    throw new Error(error.message);
  }
  revalidatePath("/dashboard/my-orders");
}
