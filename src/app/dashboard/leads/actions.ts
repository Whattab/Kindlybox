"use server";

import { createClient } from "@/utils/supabase/server";
import { assertAdmin } from "@/utils/admin";
import { revalidatePath } from "next/cache";

export async function deleteLead(id: string) {
  await assertAdmin();
  const supabase = createClient();

  // gift_suggestions.session_id references quiz_sessions(id) ON DELETE CASCADE,
  // so removing the session also clears its suggestions automatically.
  const { error } = await supabase.from("quiz_sessions").delete().eq("id", id);
  if (error) {
    console.error("Delete lead error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/leads");
}
