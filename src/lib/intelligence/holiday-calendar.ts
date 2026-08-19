// Deterministic seasonal signal — no network, no cost, 100% reliable.
// Returns the gift-relevant occasions with how many days away they are, plus a
// seasonal-relevance score that peaks a few weeks BEFORE the date (when people
// actually shop) and falls off afterwards.

export interface UpcomingOccasion {
  key: string;          // "mothers_day"
  label: string;        // "Mother's Day"
  date: Date;           // next occurrence
  daysUntil: number;
  seasonalScore: number; // 0..100, peaks ~2–6 weeks out
  recipientHint?: string; // the recipient this occasion implies (e.g. "mom")
}

// nth weekday of a month (0=Sun). n=-1 → last.
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  if (n > 0) {
    const first = new Date(year, month, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month, 1 + offset + (n - 1) * 7);
  }
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - offset);
}

// Given a "compute the date for a year" fn, return the next future occurrence.
function nextOccurrence(now: Date, forYear: (y: number) => Date): Date {
  const y = now.getFullYear();
  const thisYear = forYear(y);
  // Treat an occasion as "past" once it's more than 1 day behind us.
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 1);
  return thisYear >= cutoff ? thisYear : forYear(y + 1);
}

const DEFS: { key: string; label: string; forYear: (y: number) => Date; recipientHint?: string }[] = [
  { key: "valentines_day",  label: "Valentine's Day", forYear: (y) => new Date(y, 1, 14), recipientHint: "partner" },
  { key: "mothers_day",     label: "Mother's Day",    forYear: (y) => nthWeekday(y, 4, 0, 2), recipientHint: "mom" },
  { key: "fathers_day",     label: "Father's Day",    forYear: (y) => nthWeekday(y, 5, 0, 3), recipientHint: "dad" },
  { key: "graduation",      label: "Graduation",      forYear: (y) => new Date(y, 4, 20), recipientHint: "graduate" },
  { key: "halloween",       label: "Halloween",       forYear: (y) => new Date(y, 9, 31) },
  { key: "thanksgiving",    label: "Thanksgiving",    forYear: (y) => nthWeekday(y, 10, 4, 4) },
  { key: "christmas",       label: "Christmas",       forYear: (y) => new Date(y, 11, 25) },
  { key: "new_year",        label: "New Year",        forYear: (y) => new Date(y, 0, 1) },
];

// Seasonal shopping curve: ramps up from ~10 weeks out, peaks around 2–5 weeks
// before, still hot in the final days, then drops sharply after the date.
function seasonalScore(daysUntil: number): number {
  if (daysUntil < 0) return 5;
  if (daysUntil <= 3) return 70;
  if (daysUntil <= 14) return 100;
  if (daysUntil <= 35) return 95;
  if (daysUntil <= 56) return 80;
  if (daysUntil <= 84) return 55;
  if (daysUntil <= 120) return 30;
  return 12;
}

export function upcomingOccasions(now: Date = new Date()): UpcomingOccasion[] {
  return DEFS.map((d) => {
    const date = nextOccurrence(now, d.forYear);
    const daysUntil = Math.round((date.getTime() - now.getTime()) / 86_400_000);
    return {
      key: d.key,
      label: d.label,
      date,
      daysUntil,
      seasonalScore: seasonalScore(daysUntil),
      recipientHint: d.recipientHint,
    };
  }).sort((a, b) => a.daysUntil - b.daysUntil);
}
