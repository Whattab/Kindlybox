import Link from "next/link";
import { Music, Mail as MailIcon, Sparkles, Check, ArrowRight } from "lucide-react";
import { SERVICES, PRICES_CENTS, formatPrice, type ServiceType } from "@/lib/extras";

export const metadata = {
  title: "Custom Songs & Greeting Cards | KindlyBox",
  description: "Make it unforgettable — a custom song and a greeting card in your own words, for any occasion.",
};

const ICONS: Record<ServiceType, any> = { song: Music, card: MailIcon, bundle: Sparkles };

export default function ExtrasPage() {
  const order: ServiceType[] = ["song", "card", "bundle"];

  return (
    <main className="min-h-screen bg-background">
      <header className="px-6 py-4 border-b border-primary/5 bg-white shadow-sm flex items-center justify-between">
        <Link href="/">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-primary hover:text-primary/80 transition-colors">
            KindlyBox
          </h1>
        </Link>
        <Link href="/quiz" className="text-sm font-medium text-gray-600 hover:text-accent">Take the quiz</Link>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center p-3 bg-accent/10 rounded-full mb-4">
            <Sparkles className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
            Make it unforgettable
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Go beyond the gift. Add a custom song or a greeting card in your own words —
            personally crafted for the occasion and the person.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {order.map((type) => {
            const svc = SERVICES[type];
            const Icon = ICONS[type];
            const featured = type === "bundle";
            return (
              <div
                key={type}
                className={`relative bg-white rounded-3xl p-8 shadow-xl shadow-primary/5 border flex flex-col ${
                  featured ? "border-accent ring-2 ring-accent/20" : "border-gray-100"
                }`}
              >
                {featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full shadow">
                    Best value
                  </span>
                )}
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 mb-4">
                  <Icon className="w-6 h-6 text-accent" />
                </div>
                <h2 className="font-serif text-2xl font-bold text-primary mb-1">{svc.name}</h2>
                <p className="text-gray-500 text-sm mb-4">{svc.tagline}</p>
                <div className="text-3xl font-bold text-primary mb-5">{formatPrice(PRICES_CENTS[type])}</div>
                <p className="text-gray-600 text-sm leading-relaxed mb-5">{svc.description}</p>
                <ul className="space-y-2 mb-8 flex-grow">
                  {svc.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" /> {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/extras/${type}`}
                  className={`inline-flex items-center justify-center gap-2 w-full rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
                    featured
                      ? "bg-accent text-white hover:bg-accent/90"
                      : "bg-primary text-white hover:bg-primary/90"
                  }`}
                >
                  Order {svc.name} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-12 max-w-2xl mx-auto">
          Each piece is crafted to order and delivered by email. Typical delivery within 1–2 days.
        </p>
      </div>
    </main>
  );
}
