"use client";

// Branching quiz (Step 6b). Screens, options and rules come from the question
// graph (lib/quiz-v2/graph.ts); this component only renders them. The raw
// state is posted to /api/quiz/submit, which validates and maps it server-side.

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  Heart, Flower2, Users, Smile, Baby, Briefcase, UserRound, Crown,
  Cake, Snowflake, HandHeart, Home, Gem, GlassWater, GraduationCap, Sparkles, Gift, Sun, Leaf,
  Trees, Utensils, Sofa, Laptop, Palette, Dumbbell, BookOpen, PartyPopper, Plane, PawPrint,
  Wrench, Ticket, Shuffle, CheckCircle2, Loader2,
} from "lucide-react";
import {
  AVOIDS, BUDGETS, EMPTY_STATE, GENDERS, LEVELS, MAX_SATURDAY, RELATIONSHIPS, SATURDAYS, SCREENS,
  depthOptions, feelOptions, genderShown, levelShown, lifeStageOptions, lifeStageRequired, occasionOptions,
  pruneState, visibleScreens, type GraphContext, type Option, type ScreenId, type V2State,
} from "@/lib/quiz-v2/graph";

type Icon = ComponentType<{ className?: string }>;

const RELATIONSHIP_ICONS: Record<string, Icon> = {
  partner: Heart, mom: Flower2, dad: Crown, friend: Users, sibling: Smile, grandparent: HandHeart,
  child: Baby, coworker: Briefcase, "someone else": UserRound,
};
const OCCASION_ICONS: Record<string, Icon> = {
  birthday: Cake, holidays: Snowflake, "thank you": HandHeart, housewarming: Home, retirement: Sun,
  wedding: Gem, "new baby": Baby, sympathy: Leaf, "just because": Sparkles, anniversary: GlassWater,
  "valentine's day": Heart, graduation: GraduationCap, "mother's day": Flower2, "father's day": Crown,
};
const SATURDAY_ICONS: Record<string, Icon> = {
  outdoors: Trees, kitchen: Utensils, relaxing: Sofa, gadgets: Laptop, making: Palette, active: Dumbbell,
  reading: BookOpen, hosting: PartyPopper, traveling: Plane, pets: PawPrint,
};
const FEEL_ICONS: Record<string, Icon> = {
  practical: Wrench, sentimental: Heart, treat: Gift, fun: PartyPopper, experience: Ticket, surprise: Shuffle,
};

type StepId = ScreenId | "email";

const cardClass = (selected: boolean) =>
  `flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all duration-200 ${
    selected ? "border-accent bg-accent/5 text-accent shadow-sm" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-600"
  }`;
const chipClass = (selected: boolean) =>
  `px-4 py-2 border-2 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
    selected ? "border-accent bg-accent/5 text-accent" : "border-gray-100 hover:border-gray-200 text-gray-600"
  }`;
const inputClass =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

function Cards({ options, value, onPick, icons, multi = false, max }: {
  options: Option[]; value: string | string[]; onPick: (id: string) => void; icons?: Record<string, Icon>;
  multi?: boolean; max?: number;
}) {
  const selected = (id: string) => (Array.isArray(value) ? value.includes(id) : value === id);
  const maxed = multi && Array.isArray(value) && max != null && value.length >= max;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {options.map((o) => {
        const Ic = icons?.[o.id];
        const on = selected(o.id);
        return (
          <button key={o.id} type="button" onClick={() => onPick(o.id)} disabled={!on && maxed}
            className={`${cardClass(on)} relative disabled:opacity-50 disabled:cursor-not-allowed`}>
            {Ic && <Ic className="w-7 h-7 mb-2" />}
            <span className="font-medium text-sm text-center leading-tight">{o.label}</span>
            {multi && on && <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-accent" />}
          </button>
        );
      })}
    </div>
  );
}

function Chips({ label, hint, options, value, onPick, prominent = false }: {
  label: string; hint?: string; options: Option[]; value: string | string[]; onPick: (id: string) => void;
  prominent?: boolean; // a required follow-up question, not an optional extra
}) {
  const selected = (id: string) => (Array.isArray(value) ? value.includes(id) : value === id);
  return (
    <div>
      <p className={prominent ? "mb-3 text-xl font-serif font-bold text-primary" : "mb-3 text-sm font-semibold text-gray-700"}>
        {label} {hint && <span className="text-gray-400 font-normal">{hint}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.id} type="button" onClick={() => onPick(o.id)} className={chipClass(selected(o.id))}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface QuizFlowV2Props {
  userEmail: string | null;
  initialState?: V2State;
  depthAvailable: string[];
}

export function QuizFlowV2({ userEmail, initialState, depthAvailable }: QuizFlowV2Props) {
  const router = useRouter();
  const ctx: GraphContext = useMemo(() => ({ depthAvailable: new Set(depthAvailable) }), [depthAvailable]);
  const [state, setState] = useState<V2State>(() => pruneState(initialState ?? EMPTY_STATE, ctx));
  const [stepId, setStepId] = useState<StepId>("who");
  const topRef = useRef<HTMLDivElement>(null);
  const ageRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<StepId[]>([]);
  const [emailState, setEmailState] = useState({ firstName: "", email: userEmail || "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Every change re-prunes, so answers an earlier change made invalid vanish.
  const update = (patch: Partial<V2State>) => setState((s) => pruneState({ ...s, ...patch }, ctx));
  const toggle = (key: "saturday" | "depth" | "avoids", id: string, max?: number) =>
    setState((s) => {
      const cur = s[key] as string[];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : max != null && cur.length >= max ? cur : [...cur, id];
      return pruneState({ ...s, [key]: next }, ctx);
    });
  const single = <K extends keyof V2State>(key: K, id: string) =>
    update({ [key]: (state[key] === id ? "" : id) } as Partial<V2State>);

  const screens = visibleScreens(state, ctx);
  const steps: StepId[] = [...screens.map((s) => s.id), ...(userEmail ? [] : (["email"] as StepId[]))];
  // A branch change can hide the current screen (e.g. picking sympathy) — fall back to the last visible one.
  const currentId: StepId = steps.includes(stepId) ? stepId : steps[Math.min(history.length, steps.length - 1)];
  const stepIndex = steps.indexOf(currentId);
  const isLast = stepIndex === steps.length - 1;
  const screen = SCREENS.find((s) => s.id === currentId);

  const isValid =
    currentId === "email"
      ? emailState.firstName.trim() !== "" && emailState.email.includes("@")
      : !!screen && screen.valid(state, ctx);

  const submit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizVersion: "v2", v2: state, firstName: emailState.firstName, email: userEmail || emailState.email }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/results/${data.sessionId}`);
        return;
      }
      const errorData = await res.json().catch(() => ({ error: "Failed to submit quiz" }));
      setSubmitError(errorData.error || "Something went wrong. Please try again.");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error. Please try again.");
    }
    setIsSubmitting(false);
  };

  const next = () => {
    if (!isValid) return;
    if (isLast) return void submit();
    setHistory((h) => [...h, currentId]);
    setStepId(steps[stepIndex + 1]);
  };
  const back = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setStepId(prev);
  };

  const title = currentId === "email" ? "Where should we send the gifts?" : screen?.title(state) ?? "";

  // On a phone the next screen would otherwise open scrolled down, with its
  // question hidden above the fold. Bring the progress bar + title into view.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentId]);

  // Picking "Child" reveals a required age question below the cards — show it.
  const pickRelationship = (id: string) => {
    update({ relationship: id as V2State["relationship"] });
    if (id === "child") setTimeout(() => ageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };
  const needsAge = currentId === "who" && lifeStageRequired(state) && !state.lifeStage;

  return (
    <div ref={topRef} className="w-full max-w-3xl mx-auto px-4 py-12 sm:px-6 lg:px-8 scroll-mt-4">
      <div className="mb-10">
        <div className="flex justify-between text-xs font-semibold text-gray-400 mb-2 px-1">
          <span>Step {stepIndex + 1} of {steps.length}</span>
        </div>
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden flex">
          <div className="h-full bg-accent transition-all duration-500 ease-in-out" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-primary/5 p-6 sm:p-12 min-h-[400px] flex flex-col transition-all">
        <h2 className="text-3xl font-serif font-bold text-primary mb-8 text-center">{title}</h2>

        <div className="flex-grow space-y-8">
          {currentId === "who" && (
            <>
              <Cards options={RELATIONSHIPS} value={state.relationship} icons={RELATIONSHIP_ICONS}
                onPick={pickRelationship} />
              {lifeStageOptions(state).length > 0 && (
                <div ref={ageRef}>
                  <Chips label="How old are they?" hint={lifeStageRequired(state) ? undefined : "(optional)"}
                    prominent={lifeStageRequired(state)}
                    options={lifeStageOptions(state)} value={state.lifeStage} onPick={(id) => single("lifeStage", id)} />
                </div>
              )}
              {genderShown(state) && (
                <Chips label="Shopping for" hint="(optional)" options={GENDERS} value={state.gender} onPick={(id) => single("gender", id)} />
              )}
              {state.relationship && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Their name <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input type="text" value={state.recipientName} maxLength={80} className={inputClass}
                    onChange={(e) => update({ recipientName: e.target.value })} placeholder="Maya, Alex & Jordan, or just a nickname" />
                  <p className="mt-2 text-xs text-gray-500">We use it to make the note on each gift feel personal.</p>
                </div>
              )}
            </>
          )}

          {currentId === "occasion" && (
            <Cards options={occasionOptions(state)} value={state.occasion} icons={OCCASION_ICONS}
              onPick={(id) => update({ occasion: id as V2State["occasion"] })} />
          )}

          {currentId === "saturday" && (
            <>
              <p className="text-sm text-gray-500 text-center -mt-4">Pick up to {MAX_SATURDAY}.</p>
              <Cards options={SATURDAYS} value={state.saturday} icons={SATURDAY_ICONS} multi max={MAX_SATURDAY}
                onPick={(id) => toggle("saturday", id, MAX_SATURDAY)} />
            </>
          )}

          {currentId === "depth" && (
            <>
              {depthOptions(state, ctx).length > 0 && (
                <Chips label="Anything specific?" hint="(optional — pick any)" options={depthOptions(state, ctx)}
                  value={state.depth} onPick={(id) => toggle("depth", id)} />
              )}
              {levelShown(state) && (
                <Chips label="How into it are they?" hint="(optional)" options={LEVELS} value={state.level} onPick={(id) => single("level", id)} />
              )}
            </>
          )}

          {currentId === "feel" && (
            <Cards options={feelOptions(state)} value={state.feel} icons={FEEL_ICONS} onPick={(id) => update({ feel: id as V2State["feel"] })} />
          )}

          {currentId === "budget" && (
            <>
              <div className="flex flex-col gap-3 max-w-sm mx-auto">
                {BUDGETS.map((b) => (
                  <button key={b.id} type="button" onClick={() => update({ budget: b.id })} className={cardClass(state.budget === b.id)}>
                    <span className="font-medium text-lg text-center">{b.label}</span>
                  </button>
                ))}
              </div>
              <Chips label="Anything to avoid?" hint="(optional)" options={AVOIDS} value={state.avoids} onPick={(id) => toggle("avoids", id)} />
            </>
          )}

          {currentId === "note" && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                What&apos;s one thing they&apos;ve mentioned wanting — or something they already love?{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea value={state.freeText} rows={3} maxLength={1000} className={inputClass}
                onChange={(e) => update({ freeText: e.target.value })}
                placeholder={'e.g. "keeps talking about making bread" or "obsessed with her houseplants" — the more specific, the better the picks.'} />
              <p className="mt-2 text-xs text-gray-500">This is what makes the note on each gift feel personal, so even a few words help.</p>
            </div>
          )}

          {currentId === "email" && (
            <div className="max-w-sm mx-auto flex flex-col gap-6">
              <div className="text-center">
                <Gift className="w-12 h-12 text-accent mx-auto mb-4" />
                <p className="text-gray-600">We&apos;ve found 3 perfect gifts! Tell us where to send your curated recommendations.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" value={emailState.firstName} className={inputClass} placeholder="Jane"
                    onChange={(e) => setEmailState((s) => ({ ...s, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input type="email" value={emailState.email} className={inputClass} placeholder="jane@example.com"
                    onChange={(e) => setEmailState((s) => ({ ...s, email: e.target.value }))} />
                </div>
              </div>
            </div>
          )}
        </div>

        {submitError && (
          <div className="mt-6 p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl text-center text-sm font-medium">{submitError}</div>
        )}

        {needsAge && <p className="mt-6 text-center text-sm font-medium text-accent">Pick their age to continue.</p>}

        <div className="mt-10 flex justify-between items-center pt-6 border-t border-gray-100">
          <button type="button" onClick={back}
            className={`px-6 py-2 rounded-xl font-medium transition-colors ${history.length === 0 ? "invisible" : "text-gray-500 hover:bg-gray-100"}`}>
            ← Back
          </button>
          <button type="button" onClick={next} disabled={!isValid || isSubmitting}
            className={`${isLast ? "bg-accent hover:bg-accent/90" : "bg-primary hover:bg-primary/90"} text-white px-8 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2`}>
            {isSubmitting ? (<><Loader2 className="w-5 h-5 animate-spin" /> Finding Gifts...</>) : isLast ? "Get My Matches ✨" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
