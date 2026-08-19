import { Mail, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "Contact · KindlyBox",
  description: "Get in touch with the KindlyBox support team.",
};

// Temporary support inbox until a branded address is set up.
const SUPPORT_EMAIL = "Kindlyboxllc@gmail.com";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col font-sans">
      <SiteNav />

      <div className="flex-grow px-6 py-24">
        <div className="max-w-[640px] mx-auto text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500 mb-3.5">
            Get in touch
          </p>
          <h1 className="font-serif font-semibold text-4xl lg:text-5xl leading-tight text-primary mb-4">
            We&apos;re here to help.
          </h1>
          <p className="text-base leading-relaxed text-gray-500 max-w-[500px] mx-auto mb-12">
            Questions about an order, a gift recommendation, or a custom song or card? Reach out any
            time — a real person reads every message.
          </p>

          {/* Support email — a functional mailto so clicking opens the user's mail app. */}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=KindlyBox%20Support`}
            className="group block bg-[#F8F3E5] border border-[#D9C9A3] rounded-[20px] p-8 sm:p-10 transition-shadow hover:shadow-lg"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "linear-gradient(135deg,#D8B144,#8B2942)" }}
            >
              <Mail className="w-6 h-6 text-[#FBF6EA]" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Email our support team
            </p>
            <p className="font-serif text-2xl sm:text-3xl font-semibold text-primary group-hover:text-[#8B2942] transition-colors break-all">
              {SUPPORT_EMAIL}
            </p>
            <span className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-[#8B2942]">
              Send us a message <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </a>

          <p className="inline-flex items-center gap-2 text-sm text-gray-500 mt-8">
            <Clock className="w-4 h-4 text-accent" />
            We usually reply within 1 business day.
          </p>

          <p className="text-sm text-gray-400 mt-6">
            Already placed an order? Include your order number so we can help faster — or check its
            status anytime in{" "}
            <Link href="/dashboard/my-orders" className="font-semibold text-accent hover:underline">
              My Orders
            </Link>
            .
          </p>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
