// Which quiz a visitor sees (Step 6 switch). Pure, so it's unit-tested.
//
//   ?quiz=v1|v2           forces a version (and the page remembers it)
//   kb_quiz cookie        the visitor's remembered version
//   QUIZ_V2_PERCENT=0-100 share of NEW visitors who get v2 (unset = 0 = all v1)
//
// Turning v2 off: set QUIZ_V2_PERCENT=0 on Vercel and redeploy. Visitors who
// already have a v2 cookie would keep v2, so for an emergency stop set
// QUIZ_V2_OFF=1, which forces v1 for everyone regardless of cookie or URL.

export type QuizVersion = "v1" | "v2";
export const QUIZ_COOKIE = "kb_quiz";

const asVersion = (v: unknown): QuizVersion | null => (v === "v1" || v === "v2" ? v : null);

export function chooseQuizVersion(opts: {
  override?: unknown;
  cookie?: unknown;
  percent?: string;
  killSwitch?: string;
  random?: () => number;
}): { version: QuizVersion; remember: boolean } {
  if (opts.killSwitch === "1" || opts.killSwitch === "true") return { version: "v1", remember: false };
  const forced = asVersion(opts.override);
  if (forced) return { version: forced, remember: true };
  const remembered = asVersion(opts.cookie);
  if (remembered) return { version: remembered, remember: false };
  const pct = Math.max(0, Math.min(100, Number(opts.percent) || 0));
  if (pct === 0) return { version: "v1", remember: false }; // nothing to remember while v2 is off
  return { version: (opts.random ?? Math.random)() * 100 < pct ? "v2" : "v1", remember: true };
}
