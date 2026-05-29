import Link from "next/link";

export default function AuthCodeError() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md shrink-0 rounded-2xl bg-white p-8 shadow-xl shadow-primary/5 sm:p-10 text-center">
        <h1 className="mb-4 text-2xl font-bold text-red-600">
          Authentication Error
        </h1>
        <p className="mb-8 text-gray-600">
          We couldn't verify your secure link. It may have expired or already been used.
        </p>
        <Link 
          href="/auth/login"
          className="inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        >
          Return to login
        </Link>
      </div>
    </div>
  );
}
