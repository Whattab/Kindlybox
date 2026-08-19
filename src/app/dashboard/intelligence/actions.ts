"use server";

import { assertAdmin } from "@/utils/admin";
import { createServiceClient } from "@/utils/supabase/admin";
import { runIntelligenceEngine } from "@/lib/intelligence/pipeline";
import { revalidatePath } from "next/cache";

const VALID_STATUS = new Set([
  "DISCOVERED", "ANALYZING", "RECOMMENDED", "APPROVED",
  "WRITING", "REVIEW", "PUBLISHED", "UPDATE_REQUIRED", "ARCHIVED",
]);

export async function runEngine() {
  await assertAdmin();
  const summary = await runIntelligenceEngine();
  revalidatePath("/dashboard/intelligence");
  return summary;
}

export async function setOpportunityStatus(id: string, status: string) {
  const user = await assertAdmin();
  if (!VALID_STATUS.has(status)) throw new Error("Invalid status");
  const admin = createServiceClient();
  const patch: Record<string, any> = { status, updated_at: new Date().toISOString() };
  if (status === "APPROVED") {
    patch.approved_by = user.email;
    patch.approved_at = new Date().toISOString();
  }
  const { error } = await admin.from("content_opportunities").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/intelligence");
}
