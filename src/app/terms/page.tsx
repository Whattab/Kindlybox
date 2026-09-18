import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "Terms of Service · KindlyBox",
  description: "The terms that govern your use of KindlyBox.",
};

const EFFECTIVE = "September 18, 2026";
const SUPPORT_EMAIL = "info@kindlybox.com";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col font-sans">
      <SiteNav />

      <article className="flex-grow px-6 py-16 sm:py-20">
        <div className="max-w-[720px] mx-auto">
          <h1 className="font-serif font-semibold text-4xl lg:text-5xl leading-tight text-primary mb-3">
            Terms of Service
          </h1>
          <p className="text-sm text-gray-400 mb-10">Effective {EFFECTIVE}</p>

          <div className="space-y-8 text-[15px] leading-relaxed text-gray-600">
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) govern your use of{" "}
              <span className="whitespace-nowrap">kindlybox.com</span> and the services offered by
              KindlyBox LLC (&ldquo;KindlyBox,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;). By using the
              Site, you agree to these Terms. If you do not agree, please do not use the Site.
            </p>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Eligibility &amp; accounts</h2>
              <p>
                You must be at least 18 years old, or use the Site under the supervision of a parent or
                guardian. If you create an account, you agree to provide accurate information and to keep
                your login credentials secure. You are responsible for activity under your account.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">What KindlyBox provides</h2>
              <p>
                KindlyBox offers gift recommendations, editorial gift guides, and its own digital products
                (such as custom songs and cards). Many recommended products are sold by third-party
                merchants and are reached through affiliate links.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Affiliate links &amp; third-party merchants</h2>
              <p>
                We may earn a commission when you purchase through links on our Site, at no additional cost
                to you. We are <strong className="text-gray-700">not</strong> the seller of third-party
                products. Prices, availability, descriptions, shipping, returns, and fulfillment are
                controlled by the merchant, and your purchase is subject to that merchant&rsquo;s terms. We
                are not responsible for third-party products, and product information (including price) may
                be out of date — always confirm details on the merchant&rsquo;s site.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Digital products &amp; payments</h2>
              <p>
                Orders for our own digital products are processed through Stripe. By placing an order, you
                authorize the charge shown at checkout. Because custom songs and cards are personalized and
                created for you, refunds are handled case by case — contact us if there is a problem with
                your order and we will make it right where we reasonably can.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Acceptable use</h2>
              <p>You agree not to misuse the Site, including by attempting to disrupt it, access it without authorization, scrape it at scale, infringe intellectual property, or use it for unlawful purposes.</p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Intellectual property</h2>
              <p>
                The Site&rsquo;s content, branding, and design are owned by KindlyBox or its licensors and
                may not be copied or reused without permission. Product names and images belong to their
                respective owners.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Disclaimers</h2>
              <p>
                The Site and recommendations are provided &ldquo;as is,&rdquo; without warranties of any
                kind. We do not guarantee that a recommended gift will be suitable, available, or
                accurately priced. Use of the Site is at your own risk.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Limitation of liability</h2>
              <p>
                To the fullest extent permitted by law, KindlyBox will not be liable for indirect,
                incidental, or consequential damages arising from your use of the Site or purchases made
                through third-party merchants.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Changes &amp; governing law</h2>
              <p>
                We may update these Terms from time to time; continued use of the Site means you accept the
                updated Terms. These Terms are governed by the applicable laws of the United States,
                without regard to conflict-of-laws rules.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Contact us</h2>
              <p>
                Questions about these Terms? Email{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-accent hover:underline">{SUPPORT_EMAIL}</a>{" "}
                or visit our <Link href="/contact" className="font-semibold text-accent hover:underline">Contact page</Link>.
              </p>
            </section>
          </div>
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}
