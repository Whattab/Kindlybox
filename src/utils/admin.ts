// Admin access control.
//
// Admins are defined by an allowlist of email addresses in the ADMIN_EMAILS
// env var (comma-separated). This avoids a DB/schema change while still
// gating destructive catalogue actions to specific people.
//
//   ADMIN_EMAILS=you@example.com,partner@example.com

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

// For pages/layouts: send non-admins away. Returns the admin user.
export async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  if (!isAdminEmail(user.email)) redirect("/dashboard");
  return user;
}

// For server actions: throw instead of redirecting (defense in depth).
export async function assertAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    throw new Error("Unauthorized");
  }
  return user;
}
