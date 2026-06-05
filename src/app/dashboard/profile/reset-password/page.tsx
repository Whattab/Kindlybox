import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * Reset Password page.
 * Users land here from a password-reset email link AFTER /auth/confirm has
 * successfully verified the OTP and created a session. From here they pick
 * a new password.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { message?: string };
}) {
  // The user must be authenticated to be here. /auth/confirm should have
  // already given them a session via the recovery flow. If somehow they
  // arrived without one, bounce them to login.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?message=Please request a new password reset link.");
  }

  const updatePassword = async (formData: FormData) => {
    "use server";

    const password = formData.get("password") as string;
    const confirm = formData.get("confirm") as string;

    if (!password || password.length < 6) {
      return redirect(
        "/dashboard/profile/reset-password?message=Password must be at least 6 characters.",
      );
    }
    if (password !== confirm) {
      return redirect(
        "/dashboard/profile/reset-password?message=Passwords do not match.",
      );
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error("updatePassword error:", error);
      return redirect(
        `/dashboard/profile/reset-password?message=${encodeURIComponent(error.message)}`,
      );
    }

    return redirect("/dashboard?message=Password updated successfully.");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm shrink-0 rounded-2xl bg-white p-8 shadow-xl shadow-primary/5 sm:p-10">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <h1 className="font-serif text-3xl font-bold tracking-tight text-primary">
              KindlyBox
            </h1>
          </Link>
          <p className="mt-2 text-sm text-gray-500">
            Choose a new password for your account.
          </p>
        </div>

        <form className="flex flex-col gap-5" action={updatePassword}>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="At least 6 characters"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label
              htmlFor="confirm"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Confirm new password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={6}
              placeholder="Re-enter your new password"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <SubmitButton
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            pendingText="Saving…"
          >
            Update Password
          </SubmitButton>

          {searchParams?.message && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {searchParams.message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
