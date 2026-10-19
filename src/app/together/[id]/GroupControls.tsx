"use client";

// Interactive bits of the group page. Each one calls a server action and then
// refreshes the page, so the server-rendered tallies are always the truth.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Share2, Trash2, X } from "lucide-react";
import { castVote, deleteGroup, emailOrganiserLink, joinGroup, leaveGroup, lockInGift, removeMember, unlockGift, type GroupResult } from "../actions";
import { inputClass } from "../new/CreateGroupForm";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<GroupResult>) => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) { setError(res.error); return false; }
      router.refresh();
      return true;
    } catch {
      setError("Something went wrong. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export function InviteButton({ link, title, label = "Invite friends" }: { link: string; title: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      if (navigator.share) return await navigator.share({ title, url: link });
    } catch { return; } // closed the share sheet
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };
  return (
    <button type="button" onClick={share}
      className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-primary/90">
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Link copied" : label}
    </button>
  );
}

export function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* blocked */ }
    }} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-primary">
      {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function JoinCard({ groupId, picks, me }: {
  groupId: string;
  picks: { id: string; name: string }[];
  me: { name: string; isOrganiser: boolean } | null;
}) {
  const [name, setName] = useState("");
  const [vote, setVote] = useState<string>("");
  const { busy, error, run } = useAction();

  if (me) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-primary"><Check className="inline w-4 h-4 text-accent mr-1" />You&apos;re in as <strong>{me.name}</strong>{me.isOrganiser ? " (organiser)" : ""}.</p>
        {!me.isOrganiser && (
          <button type="button" disabled={busy} onClick={() => run(() => leaveGroup(groupId))}
            className="text-xs text-gray-500 underline">Leave the group</button>
        )}
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => joinGroup(groupId, name, vote || null));
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      <p className="font-semibold text-primary">Count me in</p>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required className={inputClass} placeholder="Your name" autoComplete="given-name" />
      <select value={vote} onChange={(e) => setVote(e.target.value)} className={inputClass}>
        <option value="">My favourite gift… (optional)</option>
        {picks.map((p) => <option key={p.id} value={p.id}>{p.name.length > 70 ? `${p.name.slice(0, 70)}…` : p.name}</option>)}
      </select>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button type="submit" disabled={busy || !name.trim()}
        className="w-full bg-accent text-white px-6 py-3 rounded-xl font-semibold hover:bg-accent/90 disabled:opacity-50 shadow-md flex items-center justify-center gap-2">
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : "I'm in"}
      </button>
    </form>
  );
}

export function VoteButton({ groupId, suggestionId, mine, orgKey }: { groupId: string; suggestionId: string; mine: boolean; orgKey?: string | null }) {
  const { busy, error, run } = useAction();
  if (mine) return <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent"><Check className="w-4 h-4" /> Your vote</span>;
  return (
    <>
      <button type="button" disabled={busy} onClick={() => run(() => castVote(groupId, suggestionId, orgKey))}
        className="rounded-full border border-primary/15 bg-white px-4 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">
        {busy ? "…" : "Vote for this"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </>
  );
}

export function ChooseGift({ groupId, suggestionId, orgKey, defaultTotal }: {
  groupId: string; suggestionId: string; orgKey: string; defaultTotal: string;
}) {
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState(defaultTotal);
  const { busy, error, run } = useAction();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary/90">
        Choose this gift
      </button>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); void run(() => lockInGift(groupId, suggestionId, total, orgKey)); }}
      className="w-full mt-2 rounded-xl border border-gray-200 bg-white p-3 space-y-2">
      <label className="block text-sm font-semibold text-primary">Total price to split</label>
      <p className="text-xs text-gray-500">Check the price at the shop, including shipping and tax.</p>
      <div className="flex gap-2">
        <input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" required className={inputClass} placeholder="e.g. 89.99" />
        <button type="submit" disabled={busy} className="rounded-xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "…" : "Save"}
        </button>
      </div>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 underline">Cancel</button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

export function UnlockButton({ groupId, orgKey }: { groupId: string; orgKey: string }) {
  const { busy, run } = useAction();
  return (
    <button type="button" disabled={busy} onClick={() => run(() => unlockGift(groupId, orgKey))}
      className="text-xs text-gray-500 underline">Change the pick or total</button>
  );
}

export function RemoveMemberButton({ groupId, memberId, orgKey, name }: { groupId: string; memberId: string; orgKey: string; name: string }) {
  const { busy, run } = useAction();
  return (
    <button type="button" disabled={busy} aria-label={`Remove ${name}`} title={`Remove ${name}`}
      onClick={() => { if (window.confirm(`Remove ${name} from the group?`)) void run(() => removeMember(groupId, memberId, orgKey)); }}
      className="ml-1 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-red-600">
      <X className="w-3.5 h-3.5" />
    </button>
  );
}

export function EmailLinkForm({ groupId, orgKey }: { groupId: string; orgKey: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();
  if (sent) return <p className="font-semibold text-accent"><Check className="inline w-4 h-4 mr-1" />Sent! Check your inbox (and spam folder).</p>;
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (await run(() => emailOrganiserLink(groupId, email, orgKey))) setSent(true); }}
      className="space-y-2">
      <p>Email me my organiser link:</p>
      <div className="flex gap-2">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254}
          className={inputClass} placeholder="you@example.com" autoComplete="email" inputMode="email" />
        <button type="submit" disabled={busy || !email.trim()} className="rounded-xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "…" : "Send"}
        </button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
    </form>
  );
}

export function DeleteGroupButton({ groupId, orgKey, afterHref }: { groupId: string; orgKey: string; afterHref: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    if (busy || !window.confirm("Delete this group for everyone? Friends' votes are removed and the invite link stops working. This can't be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await deleteGroup(groupId, orgKey);
      if (res.ok) return router.push(afterHref);
      setError(res.error);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setBusy(false);
  };
  return (
    <div className="text-center">
      <button type="button" onClick={remove} disabled={busy}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline disabled:opacity-50">
        <Trash2 className="w-4 h-4" /> {busy ? "Deleting…" : "Delete this group"}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
