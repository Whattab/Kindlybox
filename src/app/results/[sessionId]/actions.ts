"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveGiftToProfile(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const gift_name = formData.get("gift_name") as string;
  const gift_description = formData.get("gift_description") as string;
  const image_url = formData.get("image_url") as string;
  const gift_id = formData.get("gift_id") as string | null;
  const price_paid = formData.get("price_paid") ? Number(formData.get("price_paid")) : null;
  const session_id = formData.get("session_id") as string;

  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    gift_name,
    gift_id: gift_id || null,
    notes: gift_description || null,
    price_paid,
    status: "saved",
    purchased_at: new Date().toISOString().split("T")[0],
    recipient_name: "Saved from quiz",
  };

  if (image_url) {
    insertPayload.gift_image_url = image_url;
  }

  let { error } = await supabase.from("purchases").insert(insertPayload);

  if (error && (error.message.includes("gift_image_url") || error.code === "42703")) {
    const fallbackPayload = { ...insertPayload };
    delete fallbackPayload.gift_image_url;
    ({ error } = await supabase.from("purchases").insert(fallbackPayload));
  }

  if (error) {
    console.error("Save gift error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/gifts");
  revalidatePath(`/results/${session_id}`);
  redirect(`/dashboard/gifts`);
}
