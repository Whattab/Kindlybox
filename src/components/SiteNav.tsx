import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

// Shared solid nav bar for marketing sub-pages (About, Contact). The homepage
// uses its own transparent nav that overlays the hero, so it isn't used there.
export async function SiteNav() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <nav className="w-full border-b border-gray-100 bg-background/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <Link href="/" className="font-serif text-2xl font-bold tracking-tight text-primary">
        KindlyBox
      </Link>
      <div className="flex items-center gap-6">
        {session ? (
          <Link href="/dashboard" className="text-sm font-semibold text-primary hover:text-accent transition-colors">
            Dashboard
          </Link>
        ) : (
          <Link href="/auth/login" className="text-sm font-semibold text-primary hover:text-accent transition-colors">
            Sign In
          </Link>
        )}
        <Link
          href="/quiz"
          className="bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-primary/90 transition-all shadow-md"
        >
          Find a Gift
        </Link>
      </div>
    </nav>
  );
}
