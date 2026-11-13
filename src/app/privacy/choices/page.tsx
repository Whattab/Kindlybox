import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PrivacyChoices } from "./PrivacyChoices";

export const metadata: Metadata = {
  title: "Do Not Sell or Share My Personal Information · KindlyBox",
};

export default function PrivacyChoicesPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col font-sans">
      <SiteNav />
      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-12 space-y-6 text-gray-700">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary">Do Not Sell or Share My Personal Information</h1>
        <p>
          KindlyBox doesn&apos;t sell your name, email, or order details. We do use advertising pixels
          from Meta (Facebook &amp; Instagram) and Pinterest, which record that you visited our site so
          we can show you KindlyBox ads elsewhere. Under some US state laws (including California&apos;s),
          this counts as &ldquo;sharing&rdquo; personal information for advertising, and you can opt out.
        </p>
        <PrivacyChoices />
        <p className="text-sm">
          Opting out turns off the advertising pixels on this browser. It doesn&apos;t affect our basic
          site statistics or affiliate links. We also honor the{" "}
          <a href="https://globalprivacycontrol.org" target="_blank" rel="noopener noreferrer" className="text-accent underline">Global Privacy Control</a>{" "}
          signal automatically. See our <Link href="/privacy" className="text-accent underline">Privacy Policy</Link> for more.
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
