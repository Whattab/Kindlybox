"use client";

// Song + Card Bundle — dark 10-step wizard on the shared FlowShell. Runs the
// song brief (steps 2–4) then the card brief (steps 5–8), a combined delivery
// (step 9), and a combined confirmation on the success page (step 10).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ImagePlus, Loader2, X, Plus, Link as LinkIcon, Download, Printer } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  OCCASIONS, GENRES, MOODS, CARD_DESIGNS, BUNDLE_DELIVERY_OPTIONS, BUNDLE_DELIVERY_NOTE, ASSET_BUCKET,
} from "@/lib/extras";
import { FlowShell, Chip, inputClass } from "./flow-shell";
import { startBundleCheckout, generateCardDrafts, createBuyerUploadUrl } from "./actions";

const TOTAL_STEPS = 10;
const LAST_INPUT_STEP = 8; // steps 0..8 are interactive; step 10 is the success page

interface BundleBrief {
  recipientName: string; occasion: string;
  genre: string; customGenres: string[]; mood: string; story: string;
  songNames: string; songSignature: string;
  design: string; message: string; cardNames: string; signoff: string; photoUrl: string;
  delivery: string;
}

export function BundleFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [customGenre, setCustomGenre] = useState("");
  const [drafts, setDrafts] = useState<string[]>([]);
  const [draftsBusy, setDraftsBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [brief, setBrief] = useState<BundleBrief>({
    recipientName: "", occasion: "",
    genre: "", customGenres: [], mood: "", story: "", songNames: "", songSignature: "",
    design: "", message: "", cardNames: "", signoff: "", photoUrl: "",
    delivery: "link",
  });

  const set = (patch: Partial<BundleBrief>) => setBrief((b) => ({ ...b, ...patch }));

  const canContinue = (): boolean => {
    switch (step) {
      case 0: return brief.recipientName.trim() !== "" && brief.occasion !== "";
      case 1: return brief.genre !== "" && brief.mood !== "";
      case 2: return brief.story.trim() !== "";
      case 3: return true;
      case 4: return brief.design !== "";
      case 5: return brief.message.trim() !== "";
      case 6: return true;
      case 7: return true;
      case 8: return brief.delivery !== "";
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

  const helpMeWrite = async () => {
    setDraftsBusy(true);
    try {
      setDrafts(await generateCardDrafts(brief.occasion, brief.recipientName));
    } finally {
      setDraftsBusy(false);
    }
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { path, token, publicUrl } = await createBuyerUploadUrl(file.name);
      const { error: upErr } = await supabase.storage.from(ASSET_BUCKET).uploadToSignedUrl(path, token, file);
      if (upErr) throw upErr;
      set({ photoUrl: publicUrl });
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setPhotoBusy(false);
      e.target.value = "";
    }
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
    fd.set("service_type", "bundle");
    fd.set("recipient_name", brief.recipientName.trim());
    fd.set("occasion", brief.occasion);
    fd.set("brief", JSON.stringify({
      genre: brief.genre, mood: brief.mood, story: brief.story.trim(),
      songNames: brief.songNames.trim(), songSignature: brief.songSignature.trim(),
      design: brief.design, message: brief.message.trim(),
      cardNames: brief.cardNames.trim(), signoff: brief.signoff.trim(),
      photoUrl: brief.photoUrl, delivery: brief.delivery,
    }));
    startTransition(async () => {
      const res = await startBundleCheckout(fd);
      if (res.url) window.location.href = res.url;
      else setError(res.error || "Something went wrong. Please try again.");
    });
  };

  return (
    <FlowShell
      active="bundle"
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
          <input type="text" value={brief.recipientName} onChange={(e) => set({ recipientName: e.target.value })} className={inputClass} placeholder="Maya, Dad, or a nickname" />
          <label className="block text-sm font-bold text-[#e3d7c7] mt-7 mb-3">Occasion</label>
          <div className="flex flex-wrap gap-2.5">
            {OCCASIONS.map((o) => <Chip key={o} label={o} selected={brief.occasion === o} onClick={() => set({ occasion: o })} />)}
          </div>
        </div>
      )}

      {/* Step 2: Sound and mood */}
      {step === 1 && (
        <div>
          <h1 className="text-4xl font-serif font-bold mb-3">Pick the <span className="italic text-[#D9A93E]">sound</span> and mood</h1>
          <p className="text-[#b6a898] mb-8">This sets the style for your AI-generated track.</p>
          <label className="block text-sm font-bold text-[#e3d7c7] mb-3">Genre</label>
          <div className="flex flex-wrap gap-2.5">
            {[...GENRES, ...brief.customGenres].map((g) => <Chip key={g} label={g} selected={brief.genre === g} onClick={() => set({ genre: g })} />)}
          </div>
          <div className="flex gap-2.5 mt-4">
            <input type="text" value={customGenre} onChange={(e) => setCustomGenre(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomGenre(); } }} className={inputClass} placeholder="Don't see it? Type your own genre" />
            <button type="button" onClick={addCustomGenre} className="flex-shrink-0 rounded-2xl px-5 border border-dashed border-[#6b5a49] text-[#D9A93E] font-semibold hover:bg-[#2e241d] transition-colors inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
          </div>
          <label className="block text-sm font-bold text-[#e3d7c7] mt-8 mb-3">Mood</label>
          <div className="flex flex-wrap gap-2.5">
            {MOODS.map((m) => <Chip key={m} label={m} selected={brief.mood === m} onClick={() => set({ mood: m })} />)}
          </div>
        </div>
      )}

      {/* Step 3: Their story */}
      {step === 2 && (
        <div>
          <h1 className="text-4xl font-serif font-bold mb-3">Tell us <span className="italic text-[#D9A93E]">their</span> story</h1>
          <p className="text-[#b6a898] mb-8">Specific details make specific lyrics. Vague ones make generic songs.</p>
          <label className="block text-sm font-bold text-[#e3d7c7] mb-3">Memories, inside jokes, what makes them them</label>
          <textarea value={brief.story} onChange={(e) => set({ story: e.target.value })} rows={5} className={inputClass} placeholder="The road trip where the AC broke. The nickname only you two use. The thing they always say…" />
        </div>
      )}

      {/* Step 4: Song personal details */}
      {step === 3 && (
        <div>
          <h1 className="text-4xl font-serif font-bold mb-3">Add the personal details</h1>
          <p className="text-[#b6a898] mb-8">Small touches that make it unmistakably theirs.</p>
          <label className="block text-sm font-bold text-[#e3d7c7] mb-2">Names or nicknames to include</label>
          <input type="text" value={brief.songNames} onChange={(e) => set({ songNames: e.target.value })} className={inputClass} placeholder="e.g. Mom, Bug, Sunshine" />
          <label className="block text-sm font-bold text-[#e3d7c7] mt-7 mb-2">Closing line or &quot;from&quot; signature</label>
          <input type="text" value={brief.songSignature} onChange={(e) => set({ songSignature: e.target.value })} className={inputClass} placeholder="e.g. Love, your favorite kid" />
        </div>
      )}

      {/* Step 5: Card design */}
      {step === 4 && (
        <div>
          <h1 className="text-4xl font-serif font-bold mb-3">Pick a card <span className="italic text-[#D9A93E]">design</span></h1>
          <p className="text-[#b6a898] mb-8">Sets the tone before any words go on the page.</p>
          <div className="grid grid-cols-2 gap-4">
            {CARD_DESIGNS.map((d) => (
              <button key={d.id} type="button" onClick={() => set({ design: d.id })} className={`rounded-2xl overflow-hidden border text-left transition-all ${brief.design === d.id ? "border-[#D9A93E] ring-2 ring-[#D9A93E]" : "border-[#4a3d33] hover:border-[#6b5a49]"}`}>
                <div className={`h-24 bg-gradient-to-br ${d.gradient}`} />
                <div className="bg-[#2a201a] px-4 py-3 font-bold text-[#f2e9db]">{d.id}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 6: Write message */}
      {step === 5 && (
        <div>
          <h1 className="text-4xl font-serif font-bold mb-3">Write your message</h1>
          <p className="text-[#b6a898] mb-8">Freeze up? Let us draft a few lines to start from.</p>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-bold text-[#e3d7c7]">Your message</label>
            <button type="button" onClick={helpMeWrite} disabled={draftsBusy} className="text-sm font-semibold text-[#D9A93E] inline-flex items-center gap-1 disabled:opacity-60">
              {draftsBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Help me write it
            </button>
          </div>
          {drafts.length > 0 && (
            <div className="space-y-2.5 mb-4">
              {drafts.map((d, i) => (
                <button key={i} type="button" onClick={() => set({ message: d })} className="w-full text-left rounded-2xl border border-[#4a3d33] bg-[#2a201a] px-4 py-3 text-[#d8ccbc] italic hover:border-[#6b5a49] transition-colors">&ldquo;{d}&rdquo;</button>
              ))}
            </div>
          )}
          <textarea value={brief.message} onChange={(e) => set({ message: e.target.value })} rows={5} className={inputClass} placeholder="Or write your own message here…" />
        </div>
      )}

      {/* Step 7: Card personalize */}
      {step === 6 && (
        <div>
          <h1 className="text-4xl font-serif font-bold mb-3">Personalize it</h1>
          <p className="text-[#b6a898] mb-8">This is what makes it feel made-for-them.</p>
          {brief.photoUrl ? (
            <div className="relative rounded-2xl overflow-hidden mb-6 border border-[#4a3d33] bg-[#1f1712] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brief.photoUrl} alt="card photo" className="max-h-56 max-w-full object-contain" />
              <button type="button" onClick={() => set({ photoUrl: "" })} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black" aria-label="Remove photo"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[#6b5a49] py-6 mb-6 cursor-pointer text-[#b6a898] hover:bg-[#2a201a] transition-colors">
              <input type="file" accept="image/*" onChange={handlePhoto} disabled={photoBusy} className="hidden" />
              {photoBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
              {photoBusy ? "Uploading…" : "Tap to add a photo (optional)"}
            </label>
          )}
          <label className="block text-sm font-bold text-[#e3d7c7] mb-2">Names to include</label>
          <input type="text" value={brief.cardNames} onChange={(e) => set({ cardNames: e.target.value })} className={inputClass} placeholder="e.g. from all of us at home" />
          <label className="block text-sm font-bold text-[#e3d7c7] mt-7 mb-2">Sign-off</label>
          <input type="text" value={brief.signoff} onChange={(e) => set({ signoff: e.target.value })} className={inputClass} placeholder="e.g. With love, Sarah" />
        </div>
      )}

      {/* Step 8: Card preview */}
      {step === 7 && (
        <div>
          <h1 className="text-4xl font-serif font-bold mb-3">Preview your card</h1>
          <p className="text-[#b6a898] mb-8">A preliminary look — we&apos;ll design the final card and send everything within 2 days.</p>
          <div className="rounded-3xl bg-[#F3ECDD] text-[#2a1f18] p-5">
            <span className="inline-block mb-4 rounded-full bg-[#e6d9bd] text-[#7a6a4d] text-[11px] font-bold uppercase tracking-[0.15em] px-3 py-1">
              Preliminary preview
            </span>
            <div className="rounded-2xl bg-[#e6ddc9] h-56 flex items-center justify-center text-[#8a7c68] mb-5 overflow-hidden">
              {brief.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brief.photoUrl} alt="card" className="max-h-full max-w-full object-contain" />
              ) : "Photo placeholder"}
            </div>
            <p className="font-serif text-2xl leading-snug mb-5">{brief.message ? `“${brief.message}”` : "Your message will appear here."}</p>
            {brief.signoff && <p className="text-right font-serif text-xl text-[#c94f6d]">— {brief.signoff}</p>}
          </div>
        </div>
      )}

      {/* Step 9: Combined delivery */}
      {step === 8 && (
        <div>
          <h1 className="text-4xl font-serif font-bold mb-3">Choose how it&apos;s sent</h1>
          <p className="text-[#b6a898] mb-8">The card and song are delivered a little differently.</p>
          <div className="space-y-3">
            {BUNDLE_DELIVERY_OPTIONS.map((opt) => {
              const Icon = opt.id === "link" ? LinkIcon : opt.id === "download" ? Download : Printer;
              const selected = brief.delivery === opt.id;
              return (
                <button key={opt.id} type="button" onClick={() => set({ delivery: opt.id })} className={`w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-colors border ${selected ? "border-[#D9A93E] bg-[#D9A93E]/10" : "border-[#4a3d33] bg-[#2a201a] hover:border-[#6b5a49]"}`}>
                  <span className="w-12 h-12 rounded-xl bg-[#F3ECDD] flex items-center justify-center flex-shrink-0"><Icon className="w-6 h-6 text-[#2a1f18]" /></span>
                  <span className="min-w-0">
                    <span className="block font-bold text-[#f2e9db]">{opt.label}</span>
                    <span className="block text-sm text-[#b6a898]">{opt.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 rounded-2xl border border-[#3d3128] text-[#b6a898] text-sm px-5 py-4">{BUNDLE_DELIVERY_NOTE}</div>
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-xl bg-[#3a1f1c] border border-[#a4443a] text-[#f0c9c4] text-sm px-4 py-3">{error}</p>
      )}
    </FlowShell>
  );
}
