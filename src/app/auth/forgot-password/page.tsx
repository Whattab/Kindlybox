import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";

export default function ForgotPassword({
  searchParams,
}: {
  searchParams: { message: string };
}) {
  const resetPassword = async (formData: FormData) => {
    "use server";

    const headersList = headers();
    const origin = headersList.get("origin") || 
                   (headersList.get("x-forwarded-host") 
                     ? `https://${headersList.get("x-forwarded-host")}` 
                     : `http://${headersList.get("host")}`);
    const email = formData.get("email") as string;
    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/dashboard/profile/reset-password`,
    });

    if (error) {
      return redirect("/auth/forgot-password?message=Could not authenticate user");
    }

    return redirect(
      "/auth/login?message=Check your email for the password reset link."
    );
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
            Enter your email to receive a password reset link.
          </p>
        </div>

        <form className="flex flex-col gap-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              name="email"
              placeholder="you@example.com"
              type="email"
              required
            />
          </div>

          <SubmitButton
            formAction={resetPassword}
            pendingText="Sending Link..."
          >
            Send Reset Link
          </SubmitButton>

          {searchParams?.message && (
            <p className="mt-4 text-center text-sm font-medium text-amber-600">
              {searchParams.message}
            </p>
          )}
        </form>

        <p className="mt-8 text-center text-sm text-gray-600">
          Remember your password?{" "}
          <Link
            href="/auth/login"
            className="font-semibold text-accent hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
