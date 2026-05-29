"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createOccasion(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const title = formData.get("title") as string;
  const occasion_type = formData.get("occasion_type") as string;
  const recipient_name = formData.get("recipient_name") as string;
  const recipient_relation = formData.get("recipient_relation") as string;
  const date = formData.get("date") as string;
  const recurring = formData.get("recurring") === "on";
  const budget = formData.get("budget") ? Number(formData.get("budget")) : null;
  const notes = formData.get("notes") as string;

  // 1. Insert occasion
  const { data: occasion, error: occError } = await supabase
    .from("occasions")
    .insert({
      user_id: user.id,
      title,
      occasion_type,
      recipient_name,
      recipient_relation,
      date,
      recurring,
      budget,
      notes,
    })
    .select()
    .single();

  if (occError) {
    console.error("Create occasion error:", occError);
    throw new Error(occError.message);
  }

  // 2. Fetch user's reminder preferences
  const { data: profile } = await supabase
    .from("profiles")
    .select("reminder_days")
    .eq("id", user.id)
    .single();

  const reminderDays: number[] = profile?.reminder_days || [7, 1];

  // 3. Schedule reminders
  const eventDate = new Date(date);
  const remindersToInsert = reminderDays.map((daysBefore) => {
    const sendAt = new Date(eventDate);
    sendAt.setDate(sendAt.getDate() - daysBefore);
    return {
      occasion_id: occasion.id,
      user_id: user.id,
      send_at: sendAt.toISOString(),
      status: 'pending',
      channel: 'email'
    };
  });

  // Only insert reminders that are in the future
  const futureReminders = remindersToInsert.filter(r => new Date(r.send_at) > new Date());
  
  if (futureReminders.length > 0) {
    const { error: remError } = await supabase
      .from("reminders")
      .insert(futureReminders);
      
    if (remError) console.error("Reminder scheduling error:", remError);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/occasions");
  redirect("/dashboard/occasions");
}

export async function deleteOccasion(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("occasions")
    .delete()
    .eq("id", id);
    
  if (error) {
    console.error("Delete occasion error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/occasions");
}
