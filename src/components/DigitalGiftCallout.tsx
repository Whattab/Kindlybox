import Link from "next/link";
import { Music, Mail, Sparkles, ArrowRight } from "lucide-react";
import type { DigitalSuggestion } from "@/lib/digital-suggest";

const ICON = { song: Music, card: Mail, bundle: Sparkles } as const;

// The one recommendation that's KindlyBox's OWN product — surfaced on results in
// its dark-gold "digital gift" branding so it reads as the special, unique pick
// (not just another affiliate card).
export function DigitalGiftCallout({ suggestion }: { suggestion: DigitalSuggestion }) {
  const Icon = ICON[suggestion.service];
  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-[#F3ECDD] shadow-xl"
        style={{ background: "linear-gradient(135deg,#2b211a,#221912 55%,#150f0a)" }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#D9A93E,#8B2942)" }}
          >
            <Icon className="w-6 h-6 text-[#F3ECDD]" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D9A93E] mb-1">
              The most personal gift · only on KindlyBox
            </p>
            <h3 className="font-serif text-2xl font-bold leading-snug">{suggestion.headline}</h3>
            <p className="text-sm text-[#F3ECDD]/80 leading-relaxed mt-2">{suggestion.blurb}</p>
            <div className="mt-5 flex items-center gap-4 flex-wrap">
              <Link
                href={suggestion.href}
                className="group inline-flex items-center gap-2 rounded-full bg-[#D9A93E] text-[#221912] px-5 py-2.5 text-sm font-bold hover:bg-[#e6ba54] transition-colors"
              >
                Create the {suggestion.name}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <span className="text-sm text-[#F3ECDD]/70">from ${suggestion.price}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
