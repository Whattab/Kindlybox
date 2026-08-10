"use client";

// Custom Song creation flow — dark 6-step wizard on the shared FlowShell.
// Steps 1–5 collect the brief; step 5 hands off to Stripe Checkout; the
// confirmation ("step 6") is the success page after payment returns.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Music, Link as LinkIcon, Clapperboard, Plus } from "lucide-react";
import { OCCASIONS, GENRES, MOODS, DELIVERY_OPTIONS } from "@/lib/extras";
import { FlowShell, Chip, inputClass } from "./flow-shell";
import { startSongCheckout } from "./actions";

const TOTAL_STEPS = 6;
const LAST_INPUT_STEP = 4; // 0-indexed: steps 0..4 are the five input screens

interface SongBrief {
  recipientName: string;
  occasion: string;
  genre: string;
  customGenres: string[];
  mood: string;
  story: string;
  namesToInclude: string;
  signature: string;
  delivery: string;
}

export function SongFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [customGenre, setCustomGenre] = useState("");
  const [brief, setBrief] = useState<SongBrief>({
    recipientName: "", occasion: "", genre: "", customGenres: [], mood: "",
    story: "", namesToInclude: "", signature: "", delivery: "audio",
  });

  const set = (patch: Partial<SongBrief>) => setBrief((b) => ({ ...b, ...patch }));

  const canContinue = (): boolean => {
    switch (step) {
      case 0: return brief.recipientName.trim() !== "" && brief.occasion !== "";
      case 1: return brief.genre !== "" && brief.mood !== "";
      case 2: return brief.story.trim() !== "";
      case 3: return true; // personal details are optional
      case 4: return brief.delivery !== "";
      default: return false;
    }
  };

  const addCustomGenre = () => {
    const g = customGenre.trim();
    if (!g) return;
    const exists = [...GENRES, ...brief.customGenres].some((x) => x.toLowerCase() === g.toLowerCase());
    set(exists ? { genre: g } : { customGenres: [...brief.customGenres, g], genre: g });
    setCustomGenre("");
  };

  const back = () => {
    setError(null);
    if (step > 0) setStep(step - 1);
    else router.push("/extras");
  };

  const next = () => {
    setError(null);
    if (step < LAST_INPUT_STEP) { setStep(step + 1); return; }
    const fd = new FormData();
    fd.set("service_type", "song");
    fd.set("recipient_name", brief.recipientName.trim());
    fd.set("occasion", brief.occasion);
    fd.set("brief", JSON.stringify({
      genre: brief.genre,
      mood: brief.mood,
      story: brief.story.trim(),
      namesToInclude: brief.namesToInclude.trim(),
      signature: brief.signature.trim(),
      delivery: brief.delivery,
    }));
    startTransition(async () => {
      const res = await startSongCheckout(fd);
      if (res.url) window.location.href = res.url;
      else setError(res.error || "Something went wrong. Please try again.");
    });
  };

  return (
    <FlowShell
      active="song"
      step={step}
      totalSteps={TOTAL_STEPS}
      onBack={back}
      onContinue={next}
      canContinue={canContinue()}
      isPending={isPending}
    >
      {/* Step 1: Who's it for? */}
      {step === 0 && (
        <div>
          <h1 className="text-4xl font-serif font-bold mb-3">Who&apos;s it for?</h1>
          <p className="text-[#b6a898] mb-8">Tell us the basics — this shapes everything else.</p>

          <label className="block text-sm font-bold text-[#e3d7c7] mb-2">Recipient&apos;s name</label>
          <input
            type="text"
            value={brief.recipientName}
            onChange={(e) => set({ recipientName: e.target.value })}
            className={inputClass}
            placeholder="Maya, Dad, or a nickname"
          />

          <label className="block text-sm font-bold text-[#e3d7c7] mt-7 mb-3">Occasion</label>
          <div className="flex flex-wrap gap-2.5">
            {OCCASIONS.map((o) => (
              <Chip key={o} label={o} selected={brief.occasion === o} onClick={() => set({ occasion: o })} />
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Sound and mood */}
      {step === 1 && (
        <div>
          <h1 className="text-4xl font-serif font-bold mb-3">
            Pick the <span className="italic text-[#D9A93E]">sound</span> and mood
          </h1>
          <p className="text-[#b6a898] mb-8">This sets the style for your AI-generated track.</p>

          <label className="block text-sm font-bold text-[#e3d7c7] mb-3">Genre</label>
          <div className="flex flex-wrap gap-2.5">
            {[...GENRES, ...brief.customGenres].map((g) => (
              <Chip key={g} label={g} selected={brief.genre === g} onClick={() => set({ genre: g })} />
            ))}
          </div>
          <div className="flex gap-2.5 mt-4">
            <input
              type="text"
              value={customGenre}
              onChange={(e) => setCustomGenre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomGenre(); } }}
              className={inputClass}
              placeholder="Don't see it? Type your own genre"
            />
            <button
              type="button"
              onClick={addCustomGenre}
              className="flex-shrink-0 rounded-2xl px-5 border border-dashed border-[#6b5a49] text-[#D9A93E] font-semibold hover:bg-[#2e241d] transition-colors inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          <label className="block text-sm font-bold text-[#e3d7c7] mt-8 mb-3">Mood</label>
          <div className="flex flex-wrap gap-2.5">
            {MOODS.map((m) => (
              <Chip key={m} label={m} selected={brief.mood === m} onClick={() => set({ mood: m })} />
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Their story */}
      {step === 2 && (
        <div>
          <h1 className="text-4xl font-serif font-bold mb-3">
            Tell us <span className="italic text-[#D9A93E]">their</span> story
          </h1>
          <p className="text-[#b6a898] mb-8">Specific details make specific lyrics. Vague ones make generic songs.</p>

          <label className="block text-sm font-bold text-[#e3d7c7] mb-3">Memories, inside jokes, what makes them them</label>
          <textarea
            value={brief.story}
            onChange={(e) => set({ story: e.target.value })}
            rows={5}
            className={inputClass}
            placeholder="The road trip where the AC broke. The nickname only you two use. The thing they always say…"
          />
        </div>
      )}

      {/* Step 4: Personal details */}
      {step === 3 && (
        <div>
          <h1 className="text-4xl font-serif font-bold mb-3">Add the personal details</h1>
          <p className="text-[#b6a898] mb-8">Small touches that make it unmistakably theirs.</p>

          <label className="block text-sm font-bold text-[#e3d7c7] mb-2">Names or nicknames to include</label>
          <input
            type="text"
            value={brief.namesToInclude}
            onChange={(e) => set({ namesToInclude: e.target.value })}
            className={inputClass}
            placeholder="e.g. Mom, Bug, Sunshine"
          />

          <label className="block text-sm font-bold text-[#e3d7c7] mt-7 mb-2">Closing line or &quot;from&quot; signature</label>
          <input
            type="text"
            value={brief.signature}
            onChange={(e) => set({ signature: e.target.value })}
            className={inputClass}
            placeholder="e.g. Love, your favorite kid"
          />
        </div>
      )}

      {/* Step 5: Delivery */}
      {step === 4 && (
        <div>
          <h1 className="text-4xl font-serif font-bold mb-3">Choose delivery</h1>
          <p className="text-[#b6a898] mb-8">How should they receive it?</p>

          <div className="space-y-3">
            {DELIVERY_OPTIONS.map((opt) => {
              const Icon = opt.id === "audio" ? Music : opt.id === "link" ? LinkIcon : Clapperboard;
              const selected = brief.delivery === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => set({ delivery: opt.id })}
                  className={`w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-colors border ${
                    selected ? "border-[#D9A93E] bg-[#D9A93E]/10" : "border-[#4a3d33] bg-[#2a201a] hover:border-[#6b5a49]"
                  }`}
                >
                  <span className="w-12 h-12 rounded-xl bg-[#F3ECDD] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-[#2a1f18]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold text-[#f2e9db]">{opt.label}</span>
                    <span className="block text-sm text-[#b6a898]">{opt.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-xl bg-[#3a1f1c] border border-[#a4443a] text-[#f0c9c4] text-sm px-4 py-3">{error}</p>
      )}
    </FlowShell>
  );
}
