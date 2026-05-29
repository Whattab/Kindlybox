"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createPurchase(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const gift_name = formData.get("gift_name") as string;
  const recipient_name = formData.get("recipient_name") as string;
  const occasion_id = formData.get("occasion_id") as string || null;
  const price_paid = formData.get("price_paid") ? Number(formData.get("price_paid")) : null;
  const purchased_at = formData.get("purchased_at") as string;
  const status = formData.get("status") as string || "ordered";
  const notes = formData.get("notes") as string;

  const { error } = await supabase
    .from("purchases")
    .insert({
      user_id: user.id,
      gift_name,
      recipient_name,
      occasion_id,
      price_paid,
      purchased_at,
      status,
      notes,
    });

  if (error) {
    console.error("Create purchase error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/gifts");
  redirect("/dashboard/gifts");
}

export async function updatePurchaseStatus(id: string, formData: FormData) {
  const supabase = createClient();
  const status = formData.get("status") as string;

  const { error } = await supabase
    .from("purchases")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("Update status error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/gifts");
  revalidatePath("/dashboard");
}

export async function deletePurchase(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("purchases")
    .delete()
    .eq("id", id);
    
  if (error) {
    console.error("Delete purchase error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/gifts");
  revalidatePath("/dashboard");
}
