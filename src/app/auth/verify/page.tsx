import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";

export default function VerifyOTP({
  searchParams,
}: {
  searchParams: { email?: string; message?: string; next?: string; type?: string };
}) {
  const otpType = (searchParams?.type || "signup") as any;

  const verifyCode = async (formData: FormData) => {
    "use server";

    const email = formData.get("email") as string;
    const token = formData.get("token") as string;
    const next = searchParams?.next ?? "/dashboard";
    const type = (searchParams?.type || "signup") as any;

    const supabase = createClient();

    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });

    if (error) {
      return redirect(
        `/auth/verify?email=${encodeURIComponent(
          email
        )}&type=${type}&message=${encodeURIComponent(error.message)}`
      );
    }

    return redirect(next);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg shrink-0 rounded-2xl bg-white p-8 shadow-xl shadow-primary/5 sm:p-10">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <h1 className="font-serif text-3xl font-bold tracking-tight text-primary">
              KindlyBox
            </h1>
          </Link>
          <p className="mt-2 text-sm text-gray-500">
            {otpType === "recovery" 
              ? "Check your email for a 6-digit password reset code." 
              : "Check your email for a 6-digit confirmation code."}
          </p>
        </div>

        <form className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent bg-gray-50"
              name="email"
              type="email"
              placeholder="you@example.com"
              defaultValue={searchParams?.email || ""}
              readOnly={!!searchParams?.email}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              6-Digit Code
            </label>
            <input
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent tracking-widest"
              name="token"
              placeholder="123456"
              maxLength={6}
              required
            />
          </div>

          <SubmitButton
            formAction={verifyCode}
            pendingText="Verifying..."
            className="mt-4"
          >
            Verify Email
          </SubmitButton>

          {searchParams?.message && (
            <p className="mt-4 text-center text-sm font-medium text-red-600">
              {searchParams.message}
            </p>
          )}
        </form>

        <p className="mt-8 text-center text-sm text-gray-600">
          Didn't receive a code?{" "}
          <Link
            href="/auth/signup"
            className="font-semibold text-accent hover:underline"
          >
            Sign up again
          </Link>
        </p>
      </div>
    </div>
  );
}
