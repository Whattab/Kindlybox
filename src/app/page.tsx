import Link from "next/link";
import Image from "next/image";
import { 
  ArrowRight, Heart, Gift, Mail, Star, Quote, 
  Baby, Cake, Sparkles, Home as HomeIcon, Briefcase, GraduationCap 
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function Home({
  searchParams,
}: {
  searchParams?: { message?: string };
}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const message = searchParams?.message ?? null;

  return (
    <main className="min-h-screen bg-background flex flex-col font-sans">
      {/* Optional banner — shown when redirected from /go/[slug] for a
          gift that has no destination URL set yet. Auto-dismisses on the
          next page navigation since it's read from the query param. */}
      {message && (
        <div className="bg-accent/10 border-b border-accent/30 px-6 py-3 text-center text-sm text-primary">
          {message}
        </div>
      )}

      {/* Navigation */}
      <nav className="absolute top-0 w-full z-50 px-6 py-4 flex items-center justify-between">
        <div className="font-serif text-2xl font-bold tracking-tight text-primary">
          KindlyBox
        </div>
        <div className="flex items-center gap-6">
          {session ? (
            <Link 
              href="/dashboard" 
              className="text-sm font-semibold text-primary hover:text-accent transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <Link 
              href="/auth/login" 
              className="text-sm font-semibold text-primary hover:text-accent transition-colors"
            >
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

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden flex-grow flex items-center">
        {/* Decorative Blobs */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[600px] h-[600px] bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-bold tracking-wide uppercase mb-6">
              <Sparkles className="w-4 h-4" /> The Perfect Gift, Guaranteed.
            </div>
            <h1 className="text-5xl lg:text-7xl font-serif font-bold text-primary leading-[1.1] mb-6 text-balance">
              Thoughtful gifting, <br />
              <span className="text-accent italic">made effortless.</span>
            </h1>
            <p className="text-lg lg:text-xl text-gray-600 mb-10 text-balance leading-relaxed">
              Take our 60-second quiz and we&apos;ll curate a selection of premium, personalized gifts tailored precisely to them.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link 
                href="/quiz" 
                className="group flex items-center justify-center gap-2 bg-primary text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 w-full sm:w-auto"
              >
                Find the Perfect Gift
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-4 text-sm font-medium text-gray-500">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`w-8 h-8 rounded-full border-2 border-background bg-gray-${100 * i} opacity-80`} />
                ))}
              </div>
              <p>Trusted by 10,000+ thoughtful gift givers.</p>
            </div>
          </div>
          
          <div className="relative h-[500px] lg:h-[600px] w-full rounded-[2rem] overflow-hidden shadow-2xl">
            <Image 
              src="https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=1200&auto=format&fit=crop&q=80" 
              alt="Beautifully wrapped gifts" 
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 bg-white px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-serif font-bold text-primary mb-4">How It Works</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Three simple steps to becoming the best gift-giver they know.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-accent/0 via-accent/30 to-accent/0" />
            
            <div className="relative flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-2xl bg-primary/5 text-primary flex items-center justify-center mb-6 shadow-sm rotate-3 border border-primary/10">
                <Heart className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-serif font-bold text-primary mb-3">1. Tell us about them</h3>
              <p className="text-gray-600">Answer a few quick questions about who they are, their interests, and your budget.</p>
            </div>

            <div className="relative flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-6 shadow-sm -rotate-3 border border-accent/20">
                <Gift className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-serif font-bold text-primary mb-3">2. Get curated matches</h3>
              <p className="text-gray-600">Our algorithm instantly curates 3 perfect, highly-rated gift options just for them.</p>
            </div>

            <div className="relative flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-2xl bg-gray-50 text-gray-800 flex items-center justify-center mb-6 shadow-sm rotate-3 border border-gray-200">
                <Mail className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-serif font-bold text-primary mb-3">3. Buy with one click</h3>
              <p className="text-gray-600">Purchase directly with ease, and save occasions to your dashboard for automatic reminders next time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Gift Categories */}
      <section className="py-24 bg-background px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <h2 className="text-3xl lg:text-5xl font-serif font-bold text-primary mb-4">Gifts for every moment</h2>
              <p className="text-lg text-gray-600 max-w-2xl">Explore our curated collections across occasions and interests.</p>
            </div>
            <Link href="/quiz" className="font-semibold text-accent hover:underline flex items-center gap-1">
              View all ideas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              { label: "For Her", img: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&auto=format&fit=crop&q=80", icon: Heart },
              { label: "Birthdays", img: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&auto=format&fit=crop&q=80", icon: Cake },
              { label: "For Him", img: "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=600&auto=format&fit=crop&q=80", icon: Briefcase },
              { label: "Housewarming", img: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80", icon: HomeIcon },
              { label: "Tech Lovers", img: "https://images.unsplash.com/photo-1525648199074-bee30ba3d02b?w=600&auto=format&fit=crop&q=80", icon: GraduationCap },
              { label: "Kids & Babies", img: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&auto=format&fit=crop&q=80", icon: Baby },
              { label: "Anniversaries", img: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80", icon: Sparkles },
            ].map((cat, i) => (
              <Link 
                href="/quiz" 
                key={i}
                className={`group relative overflow-hidden rounded-2xl aspect-[4/5] ${i === 0 ? 'md:col-span-2 md:row-span-2 aspect-auto' : ''}`}
              >
                <Image 
                  src={cat.img} 
                  alt={cat.label} 
                  fill 
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                    <cat.icon className="w-5 h-5" />
                  </div>
                  <span className="text-white font-serif text-xl md:text-2xl font-bold">{cat.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-24 bg-primary text-white px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl lg:text-5xl font-serif font-bold mb-6">Don&apos;t just take our word for it.</h2>
              <p className="text-primary-foreground/80 text-lg mb-8">Thousands of people use KindlyBox every day to find the most thoughtful gifts.</p>
              
              <div className="flex items-center gap-2 mb-2">
                {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-6 h-6 fill-accent text-accent" />)}
              </div>
              <p className="text-xl font-medium">4.9/5 Average rating</p>
            </div>

            <div className="grid gap-6">
              <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl border border-white/10 relative">
                <Quote className="absolute top-6 right-6 w-12 h-12 text-white/10 font-serif" />
                <p className="text-lg leading-relaxed mb-6 relative z-10">&quot;I am notoriously terrible at buying gifts for my wife. The KindlyBox quiz took me 30 seconds and the botanical spa set it suggested completely blew her away. Saved my anniversary!&quot;</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center font-bold text-xl text-accent">M</div>
                  <div>
                    <div className="font-bold font-serif text-xl">Mark T.</div>
                    <div className="text-white/60 text-sm">Bought for Partner</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white px-6 pt-16 pb-8 border-t border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
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
                <li><Link href="/dashboard" className="text-gray-500 hover:text-accent">My Dashboard</Link></li>
                <li><Link href="/auth/signup" className="text-gray-500 hover:text-accent">Create Account</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-4">Company</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-gray-500 hover:text-accent">About Us</a></li>
                <li><a href="#" className="text-gray-500 hover:text-accent">Contact</a></li>
                <li><a href="#" className="text-gray-500 hover:text-accent">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row items-center justify-between text-gray-400 text-sm">
            <p>© {new Date().getFullYear()} KindlyBox. All rights reserved.</p>
            <p className="mt-2 md:mt-0">Designed elegantly.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
