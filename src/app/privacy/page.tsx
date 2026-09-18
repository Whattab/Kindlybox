import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "Privacy Policy · KindlyBox",
  description: "How KindlyBox collects, uses, and protects your information.",
};

// Effective date — update whenever the policy materially changes.
const EFFECTIVE = "September 18, 2026";
const SUPPORT_EMAIL = "info@kindlybox.com";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col font-sans">
      <SiteNav />

      <article className="flex-grow px-6 py-16 sm:py-20">
        <div className="max-w-[720px] mx-auto">
          <h1 className="font-serif font-semibold text-4xl lg:text-5xl leading-tight text-primary mb-3">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-400 mb-10">Effective {EFFECTIVE}</p>

          <div className="space-y-8 text-[15px] leading-relaxed text-gray-600">
            <p>
              This Privacy Policy explains how KindlyBox LLC (&ldquo;KindlyBox,&rdquo;
              &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, and shares information when you use{" "}
              <span className="whitespace-nowrap">kindlybox.com</span> (the &ldquo;Site&rdquo;). By using
              the Site, you agree to this policy.
            </p>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Information we collect</h2>
              <p className="mb-3"><strong className="text-gray-700">Information you give us:</strong></p>
              <ul className="list-disc pl-5 space-y-1.5 mb-4">
                <li>Account details such as your email address and password when you sign up.</li>
                <li>Your quiz answers (recipient, occasion, interests, budget) and any name or notes you enter.</li>
                <li>Order and delivery details for digital products (custom songs and cards).</li>
                <li>Messages you send us for support.</li>
              </ul>
              <p className="mb-3"><strong className="text-gray-700">Information collected automatically:</strong></p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Usage data (pages viewed, actions taken) and general device/browser information.</li>
                <li>Approximate location derived from your IP address.</li>
                <li>Cookies and similar technologies (see below).</li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Cookies &amp; tracking</h2>
              <p className="mb-3">We and our partners use cookies and similar technologies to:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Keep you signed in and remember your preferences (essential).</li>
                <li>Measure traffic and usage through privacy-friendly analytics (Vercel Web Analytics).</li>
                <li>
                  Track referrals to merchants. When you click an affiliate link, our affiliate networks
                  (such as Awin and CJ) may set cookies so a resulting purchase is attributed to us. Those
                  cookies are governed by the networks&rsquo; own privacy policies.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">How we use your information</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Provide gift recommendations and operate the Site and your account.</li>
                <li>Process and deliver orders for digital products.</li>
                <li>Respond to your questions and provide support.</li>
                <li>Improve our recommendations, content, and services.</li>
                <li>Send you transactional messages (e.g., order confirmations, password resets).</li>
                <li>Detect, prevent, and address fraud, abuse, or security issues, and comply with law.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">How we share information</h2>
              <p className="mb-3">
                We do <strong className="text-gray-700">not</strong> sell your personal information. We
                share information with service providers who help us run the Site, only as needed:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-gray-700">Supabase</strong> — database, authentication, and storage.</li>
                <li><strong className="text-gray-700">Stripe</strong> — payment processing. Card details are handled by Stripe; we do not store full card numbers.</li>
                <li><strong className="text-gray-700">Resend</strong> — sending our emails.</li>
                <li><strong className="text-gray-700">Vercel</strong> — hosting and privacy-friendly analytics.</li>
                <li><strong className="text-gray-700">Affiliate networks</strong> (e.g., Awin, CJ) — referral tracking when you click affiliate links.</li>
              </ul>
              <p className="mt-3">We may also share information to comply with law or protect our rights.</p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Affiliate relationships</h2>
              <p>
                KindlyBox participates in affiliate programs and may earn a commission when you purchase
                through links on our Site, at no additional cost to you. Purchases are made on the
                merchant&rsquo;s website and are subject to the merchant&rsquo;s own terms and privacy
                practices.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Data retention</h2>
              <p>
                We keep personal information for as long as your account is active or as needed to provide
                the Site, meet legal obligations, resolve disputes, and enforce our agreements. You can ask
                us to delete your account at any time.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Your rights &amp; choices</h2>
              <p className="mb-3">
                Depending on where you live (including the EU/UK under GDPR and California under the
                CCPA/CPRA), you may have the right to access, correct, delete, or port your personal
                information, and to opt out of certain uses. To make a request, email us at{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-accent hover:underline">{SUPPORT_EMAIL}</a>.
                You can also manage cookies through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Children&rsquo;s privacy</h2>
              <p>
                The Site is not directed to children under 13, and we do not knowingly collect their
                personal information. If you believe a child has provided us information, contact us and we
                will delete it.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Changes to this policy</h2>
              <p>
                We may update this policy from time to time. We will post the updated version here and
                revise the &ldquo;Effective&rdquo; date above.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">Contact us</h2>
              <p>
                Questions about this policy? Email{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-accent hover:underline">{SUPPORT_EMAIL}</a>{" "}
                or visit our <Link href="/contact" className="font-semibold text-accent hover:underline">Contact page</Link>.
              </p>
              <p className="mt-3 text-sm text-gray-400">
                KindlyBox LLC · [Add your registered business mailing address here]
              </p>
            </section>
          </div>
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}
