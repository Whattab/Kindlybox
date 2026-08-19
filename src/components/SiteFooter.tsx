import Link from "next/link";

// Shared site footer — used across the homepage and the marketing pages
// (About, Contact). Holds the affiliate disclosure so it appears site-wide.
export function SiteFooter() {
  return (
    <footer className="bg-white px-6 pt-16 pb-8 border-t border-gray-100">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <Link href="/" className="font-serif text-3xl font-bold tracking-tight text-primary mb-4 block">
              KindlyBox
            </Link>
            <p className="text-gray-500 max-w-sm">
              Taking the stress out of gifting. Find the perfect, thoughtful gift for every occasion, every time.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-gray-900 mb-4">Product</h4>
            <ul className="space-y-3">
              <li><Link href="/quiz" className="text-gray-500 hover:text-accent">Take the Quiz</Link></li>
              <li><Link href="/blog" className="text-gray-500 hover:text-accent">Gift Guides</Link></li>
              <li><Link href="/dashboard" className="text-gray-500 hover:text-accent">My Dashboard</Link></li>
              <li><Link href="/auth/signup" className="text-gray-500 hover:text-accent">Create Account</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-gray-900 mb-4">Company</h4>
            <ul className="space-y-3">
              <li><Link href="/about" className="text-gray-500 hover:text-accent">About Us</Link></li>
              <li><Link href="/contact" className="text-gray-500 hover:text-accent">Contact</Link></li>
              <li><a href="#" className="text-gray-500 hover:text-accent">Privacy Policy</a></li>
            </ul>
          </div>
        </div>

        {/* Affiliate disclosure — visible on every page for FTC compliance. */}
        <p className="text-xs leading-relaxed text-gray-400 max-w-3xl mb-6">
          <span className="font-semibold text-gray-500">Affiliate Disclosure:</span> We may earn a
          small commission when you purchase items through links on our site.
        </p>

        <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row items-center justify-between text-gray-400 text-sm">
          <p>© {new Date().getFullYear()} KindlyBox. All rights reserved.</p>
          <p className="mt-2 md:mt-0">Designed elegantly.</p>
        </div>
      </div>
    </footer>
  );
}
