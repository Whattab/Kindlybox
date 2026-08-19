import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { AboutSection } from "@/components/AboutSection";

export const metadata = {
  title: "About Us · KindlyBox",
  description:
    "KindlyBox exists to solve one problem: knowing someone deserves a great gift, and still not knowing what to get them.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col font-sans">
      <SiteNav />
      <div className="flex-grow">
        <AboutSection />
      </div>
      <SiteFooter />
    </main>
  );
}
