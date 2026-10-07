"use server";

import { assertAdmin } from "@/utils/admin";
import { createServiceClient } from "@/utils/supabase/admin";
import { syncAwin } from "@/lib/affiliate/sync";
import { revalidatePath } from "next/cache";

// Trigger an on-demand Awin sync from the dashboard (the SyncButton).
export async function runAffiliateSync() {
  await assertAdmin();
  const summary = await syncAwin();
  revalidatePath("/dashboard/products");
  return summary;
}

const VALID = ["staged", "approved", "rejected"];

// Approve/reject a single product.
export async function setProductStatus(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !VALID.includes(status)) return;
  const admin = createServiceClient();
  await admin.from("products").update({ status }).eq("id", id);
  revalidatePath("/dashboard/products");
}

// Approve/reject EVERY product matching the current review filters (not just the
// visible page) — so a new merchant's hundreds can be cleared in one click. The
// filters are carried as hidden fields on the form.
export async function bulkSetStatus(formData: FormData) {
  await assertAdmin();
  const status = String(formData.get("status") || "");
  if (!VALID.includes(status)) return;
  const admin = createServiceClient();

  let q = admin.from("products").update({ status }).eq("active", true);
  const fStatus = String(formData.get("f_status") || "");
  const merchant = String(formData.get("f_merchant") || "");
  const category = String(formData.get("f_category") || "");
  const search = String(formData.get("f_q") || "").trim();
  const pmin = String(formData.get("f_pmin") || "");
  const pmax = String(formData.get("f_pmax") || "");

  if (fStatus && VALID.includes(fStatus)) q = q.eq("status", fStatus);
  if (merchant) q = q.eq("merchant_name", merchant);
  if (category) q = q.eq("category", category);
  if (search) q = q.ilike("title", `%${search}%`);
  if (pmin) q = q.gte("price", Number(pmin));
  if (pmax) q = q.lte("price", Number(pmax));

  await q;
  revalidatePath("/dashboard/products");
}
