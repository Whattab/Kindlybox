"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const full_name = formData.get("full_name") as string;
  const first_name = full_name.split(' ')[0];
  const default_currency = formData.get("default_currency") as string;
  const default_budget = formData.get("default_budget") ? Number(formData.get("default_budget")) : null;
  const email_notifications = formData.get("email_notifications") === "on";

  // Reminder days logic
  const reminderDaysValues = formData.getAll("reminder_days").map(Number);
  // Default to [7, 1] if none provided
  const reminder_days = reminderDaysValues.length > 0 ? reminderDaysValues : [7, 1];

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name,
      first_name,
      default_currency,
      default_budget,
      reminder_days,
      email_notifications,
    })
    .eq("id", user.id);

  if (error) {
    console.error("Update profile error:", error);
    throw new Error(error.message);
  }

  // Update Auth User MetaData if name changed
  await supabase.auth.updateUser({
    data: { full_name, first_name }
  });

  revalidatePath("/dashboard/profile");
}

export async function updateEmail(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const email = formData.get("email") as string;
  
  if (email === user.email) return;

  const { error } = await supabase.auth.updateUser({ email });
  
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/profile");
  return { message: "Check both your old and new emails to confirm the address change." };
}

export async function deleteAccount() {
  const supabase = createClient();
  
  // Note: True account deletion relies on Supabase Edge Functions or Admin API,
  // This is a placeholder that signs them out in standard projects or 
  // requires supabase-admin role. Using standard user API, users generally
  // can't delete their own accounts out of the box without RPC function.
  // For the sake of the demo, we will log them out.
  await supabase.auth.signOut();
  return { redirect: "/" };
}
