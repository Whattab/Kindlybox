"use client";

// "Email me these picks" (Step 6c): the v2 quiz shows gifts first and asks for
// an email afterwards. A known domain typo (gmail.col) is never sent silently:
// pressing the button stops and asks "Did you mean …?" first.

import { useState, type FormEvent } from "react";
import { Mail, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { suggestEmailFix, looksLikeEmail } from "@/lib/email-typo";
import { emailMyPicks } from "./actions";

const inputClass =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export function EmailPicksForm({ sessionId }: { sessionId: string }) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false); // showing the typo question
  const fix = suggestEmailFix(email);

  const deliver = async (to: string, typoConfirmed: boolean) => {
    setAsking(false);
    setStatus("sending");
    setError(null);
    try {
      const res = await emailMyPicks(sessionId, firstName, to, typoConfirmed);
      if (res.ok) return setStatus("sent");
      setError(res.error);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setStatus("idle");
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (status !== "idle" || !looksLikeEmail(email)) return;
    if (fix) return setAsking(true); // ask before sending to a likely typo
    void deliver(email, false);
  };

  if (status === "sent") {
    return (
      <div className="max-w-md mx-auto mt-8 rounded-2xl border border-accent/30 bg-accent/5 p-5 text-center">
        <CheckCircle2 className="w-8 h-8 text-accent mx-auto mb-2" />
        <p className="font-semibold text-primary">Sent! Check your inbox.</p>
        <p className="text-sm text-gray-500 mt-1">Not there in a minute? Look in Promotions or Spam.</p>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="max-w-md mx-auto mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-left">
      <p className="flex items-center gap-2 font-semibold text-primary mb-1">
        <Mail className="w-5 h-5 text-accent" /> Email me these picks
      </p>
      <p className="text-sm text-gray-500 mb-4">Keep them handy for when you&apos;re ready to buy.</p>
      <div className="space-y-3">
        <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={80}
          className={inputClass} placeholder="Your first name (optional)" autoComplete="given-name" />
        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setAsking(false); }} maxLength={254} required
          className={inputClass} placeholder="you@example.com" autoComplete="email" inputMode="email" />
        {fix && (
          <div className={`rounded-xl border p-3 text-sm ${asking ? "border-amber-400 bg-amber-50" : "border-amber-200 bg-amber-50/60"}`}>
            <p className="flex items-start gap-2 text-gray-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 flex-shrink-0" />
              <span>Did you mean <strong>{fix}</strong>?</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => { setEmail(fix); if (asking) void deliver(fix, false); }}
                className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-white">
                {asking ? `Yes, send to ${fix}` : `Use ${fix}`}
              </button>
              {asking && (
                <button type="button" onClick={() => void deliver(email, true)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-600">
                  No, keep {email.trim()}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      <button type="submit" disabled={!looksLikeEmail(email) || status === "sending"}
        className="mt-4 w-full bg-accent text-white px-6 py-3 rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2">
        {status === "sending" ? (<><Loader2 className="w-5 h-5 animate-spin" /> Sending…</>) : "Email me these picks"}
      </button>
    </form>
  );
}
