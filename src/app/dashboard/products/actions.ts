"use server";

import { assertAdmin } from "@/utils/admin";
import { syncAwin } from "@/lib/affiliate/sync";
import { revalidatePath } from "next/cache";

export async function runAffiliateSync() {
  await assertAdmin();
  const summary = await syncAwin();
  revalidatePath("/dashboard/products");
  return summary;
}
