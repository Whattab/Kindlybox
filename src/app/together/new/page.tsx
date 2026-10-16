import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Users } from "lucide-react";
import { createServiceClient } from "@/utils/supabase/admin";
import { CreateGroupForm } from "./CreateGroupForm";

export const metadata: Metadata = { title: "Gift together · KindlyBox", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewGroupPage({ searchParams }: { searchParams?: { s?: string } }) {
  const sessionId = searchParams?.s || "";
  if (!UUID.test(sessionId)) return notFound();
  const db = createServiceClient();
  const { data: session } = await db.from("quiz_sessions").select("id, answers").eq("id", sessionId).maybeSingle();
  if (!session) return notFound();
  const recipient: string = session.answers?.recipientName?.trim() || "";

  return (
    <main className="min-h-screen bg-background">
      <header className="px-6 py-4 border-b border-primary/5 bg-white shadow-sm">
        <Link href="/">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-primary hover:text-primary/80 transition-colors">KindlyBox</h1>
        </Link>
      </header>
      <div className="max-w-md mx-auto px-4 py-10">
        <Link href={`/results/${session.id}`} className="text-sm text-accent underline underline-offset-2">← back to the picks</Link>
        <div className="mt-6 mb-6 text-center">
          <Users className="w-10 h-10 text-accent mx-auto mb-3" />
          <h2 className="font-serif text-3xl font-bold text-primary">Gift together</h2>
          <p className="text-gray-600 mt-2 text-sm leading-relaxed">
            Share these picks with friends{recipient ? ` going in on ${recipient}'s gift` : ""}. They vote, say they&apos;re in,
            and see how much to send you. You buy the gift. KindlyBox never handles the money.
          </p>
        </div>
        <CreateGroupForm sessionId={session.id} />
      </div>
    </main>
  );
}
