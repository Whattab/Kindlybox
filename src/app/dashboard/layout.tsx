import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/utils/admin";
import { extrasEnabled } from "@/lib/extras";
import { redirect } from "next/navigation";
import { LogOut, Home as HomeIcon, Calendar, Gift, User, Boxes, Users, ShoppingBag, Music, Sparkles } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const navItems = [
    { label: "Overview", href: "/dashboard", icon: HomeIcon },
    { label: "Find a Gift", href: "/quiz", icon: Sparkles },
    { label: "Occasions", href: "/dashboard/occasions", icon: Calendar },
    { label: "Gift History", href: "/dashboard/gifts", icon: Gift },
    ...(extrasEnabled() ? [{ label: "My Orders", href: "/dashboard/my-orders", icon: Music }] : []),
    // Admin-only — the pages themselves also enforce this via requireAdmin().
    ...(isAdminEmail(user.email)
      ? [
          { label: "Catalogue", href: "/dashboard/catalog", icon: Boxes },
          { label: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
          { label: "Leads", href: "/dashboard/leads", icon: Users },
        ]
      : []),
    { label: "Profile", href: "/dashboard/profile", icon: User },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-100 flex-shrink-0">
        <div className="h-full flex flex-col p-6">
          <Link href="/" className="font-serif text-2xl font-bold tracking-tight text-primary mb-12">
            KindlyBox
          </Link>

          <nav className="space-y-2 flex-grow">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                // Ideally use usePathname to highlight active route, skipping for brevity in layout
              >
                <item.icon className="w-5 h-5 flex-shrink-0 text-gray-400" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="pt-8 border-t border-gray-100 mt-auto">
            <div className="flex items-center gap-3 px-4 py-3 text-sm text-gray-500">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center font-bold text-accent uppercase flex-shrink-0">
                {user.email?.[0]}
              </div>
              <div className="truncate">
                <p className="font-medium text-gray-900 truncate">
                  {user.user_metadata?.full_name || user.email}
                </p>
                <form action={async () => {
                  "use server";
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  redirect("/");
                }}>
                  <button type="submit" className="text-xs hover:text-red-500 hover:underline flex items-center gap-1 mt-1 transition-colors">
                    <LogOut className="w-3 h-3" /> Sign out
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

    </div>
  );
}
