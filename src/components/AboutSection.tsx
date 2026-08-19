import { Tag, Music } from "lucide-react";

// The "About KindlyBox" content — shared between the homepage section and the
// dedicated /about page so the copy only lives in one place.
export function AboutSection() {
  return (
    <section id="about" className="py-24 bg-background px-6">
      <div className="max-w-[760px] mx-auto">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500 mb-3.5">
          About KindlyBox
        </p>
        <h2 className="text-center font-serif font-semibold text-4xl lg:text-5xl leading-tight text-primary mb-4">
          Gifting made simple,<br />
          <em className="not-italic font-serif italic text-[#8B2942]">made personal.</em>
        </h2>
        <p className="text-center text-base leading-relaxed text-gray-500 max-w-[520px] mx-auto mb-14">
          KindlyBox exists to solve one problem: knowing someone deserves a great gift, and still
          not knowing what to get them. We built two ways to fix that — a quiz that finds it, and a
          studio that makes it.
        </p>

        {/* Panel 1 — the quiz */}
        <div className="bg-[#F8F3E5] border border-[#D9C9A3] rounded-[20px] p-8 sm:p-9 mb-6">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
            style={{ background: "linear-gradient(135deg,#EFE3C3,#D9C9A3)" }}
          >
            <Tag className="w-5 h-5 text-[#8B2942]" />
          </div>
          <h3 className="font-serif font-semibold text-2xl text-primary mb-2.5 leading-snug">
            The quiz: three picks, not endless scrolling
          </h3>
          <p className="text-[15px] leading-relaxed text-gray-500 mb-3.5">
            Our quiz isn&apos;t trying to guess something no one&apos;s ever thought of. It&apos;s
            built to do the thing decision fatigue makes hard on your own — take what you actually
            know about someone (their relationship to you, the occasion, their interests, your
            budget) and narrow thousands of options down to three you can trust.
          </p>
          <p className="text-[15px] leading-relaxed text-gray-500">
            Every recommendation is tied back to a specific detail you gave us, not a generic
            category. &quot;They like cooking&quot; and &quot;she mentioned Sunday soups twice&quot;
            point to two very different gifts — we build toward the second one.
          </p>
          <p className="font-hand text-xl text-[#8B2942] border-l-2 border-accent pl-3.5 mt-4">
            Real signal in, honest picks out.
          </p>
        </div>

        {/* Panel 2 — the digital studio */}
        <div className="bg-[#F8F3E5] border border-[#D9C9A3] rounded-[20px] p-8 sm:p-9">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
            style={{ background: "linear-gradient(135deg,#D8B144,#8B2942)" }}
          >
            <Music className="w-5 h-5 text-[#FBF6EA]" />
          </div>
          <h3 className="font-serif font-semibold text-2xl text-primary mb-2.5 leading-snug">
            The digital side: for when a product isn&apos;t the point
          </h3>
          <p className="text-[15px] leading-relaxed text-gray-500 mb-3.5">
            Sometimes the right gift isn&apos;t a thing — it&apos;s something made for them. Our
            digital studio turns your memories into an original song, written and produced around
            your story, or a greeting card carrying your exact words. Order both together and they
            arrive as one complete, unforgettable gift.
          </p>
          <p className="text-[15px] leading-relaxed text-gray-500">
            Every song is produced individually, so it takes a little longer than checkout — usually
            about two days. We&apos;d rather it be right than instant.
          </p>
        </div>

        <p className="text-center font-hand text-2xl text-primary mt-12">
          Thoughtful shouldn&apos;t be hard to find.
        </p>
      </div>
    </section>
  );
}
