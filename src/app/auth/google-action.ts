"use server";

// "Continue with Google" — shared by the sign-in and sign-up pages. For a new
// visitor Google sign-in creates the account, so one action serves both.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function signInWithGoogle(formData: FormData) {
  const from = formData.get("from") === "signup" ? "signup" : "login";
  const supabase = createClient();
  const headersList = headers();
  const host = headersList.get("x-forwarded-host") || headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") || (process.env.NODE_ENV === "development" ? "http" : "https");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${protocol}://${host}/auth/callback` },
  });

  if (error || !data.url) {
    console.error("Google sign-in error:", error);
    redirect(`/auth/${from}?message=${encodeURIComponent("Google sign-in isn't available right now. Please use email instead.")}`);
  }
  redirect(data.url);
}
