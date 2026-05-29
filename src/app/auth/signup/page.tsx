import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";

export default function SignUp({
  searchParams,
}: {
  searchParams: { message: string };
}) {
  const signUp = async (formData: FormData) => {
    "use server";

    const headersList = headers();
    const origin = headersList.get("origin") || 
                   (headersList.get("x-forwarded-host") 
                     ? `https://${headersList.get("x-forwarded-host")}` 
                     : `http://${headersList.get("host")}`);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          first_name: firstName,
          full_name: `${firstName} ${lastName}`.trim(),
        },
      },
    });

    if (error) {
      return redirect(`/auth/signup?message=${error.message}`);
    }

    return redirect("/auth/login?message=Check your email for a confirmation link to complete sign up.");
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
            Create an account to track your occasions.
          </p>
        </div>

        <form className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                First Name
              </label>
              <input
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                name="firstName"
                placeholder="Jane"
                required
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Last Name
              </label>
              <input
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                name="lastName"
                placeholder="Doe"
                required
              />
            </div>
          </div>
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
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              type="password"
              name="password"
              placeholder="••••••••"
              required
            />
          </div>

          <SubmitButton
            formAction={signUp}
            pendingText="Signing Up..."
            className="mt-4"
          >
            Sign Up
          </SubmitButton>

          {searchParams?.message && (
            <p className="mt-4 text-center text-sm font-medium text-red-600">
              {searchParams.message}
            </p>
          )}
        </form>

        <p className="mt-8 text-center text-sm text-gray-600">
          Already have an account?{" "}
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
