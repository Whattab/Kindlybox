import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/admin";
import { ExportLeadsButton } from "./ExportLeadsButton";
import { DeleteLeadButton } from "./DeleteLeadButton";
import { Users, Mail, UserCheck } from "lucide-react";

export const dynamic = "force-dynamic"; // always show the latest leads

export default async function LeadsPage() {
  await requireAdmin();
  const supabase = createClient();

  const { data: sessions } = await supabase
    .from("quiz_sessions")
    .select("id, email_captured, first_name_captured, created_at, answers")
    .order("created_at", { ascending: false });

  const all = sessions ?? [];
  const leads = all.filter((s) => s.email_captured);
  const uniqueEmails = new Set(
    leads.map((l) => (l.email_captured as string).toLowerCase()),
  ).size;

  const stats = [
    { label: "Total quizzes", value: all.length, icon: Users },
    { label: "Emails captured", value: leads.length, icon: Mail },
    { label: "Unique people", value: uniqueEmails, icon: UserCheck },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary">Leads</h1>
            <p className="text-gray-500 mt-0.5">Emails captured by the gift quiz.</p>
          </div>
        </div>
        <ExportLeadsButton leads={leads} />
      </div>

      {/* Funnel stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <s.icon className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">{s.label}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Leads list — cards so everything is readable without sideways scrolling */}
      <div className="space-y-3">
        {leads.map((lead) => {
          const a: any = lead.answers || {};
          const recipient = [a.recipient, a.recipientName].filter(Boolean).join(" · ");
          const interests = Array.isArray(a.interests) ? a.interests.join(", ") : "";
          return (
            <div
              key={lead.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              {/* Header: name + email + date + delete */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{lead.first_name_captured || "Anonymous"}</p>
                  <a
                    href={`mailto:${lead.email_captured}`}
                    className="text-accent hover:underline text-sm break-all"
                  >
                    {lead.email_captured}
                  </a>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </span>
                  <DeleteLeadButton id={lead.id} email={lead.email_captured as string} />
                </div>
              </div>

              {/* Quiz details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
                <Field label="For" value={recipient} capitalize />
                <Field label="Occasion" value={a.occasion} capitalize />
                <Field label="Budget" value={a.budget} />
                <Field label="Interests" value={interests} capitalize />
              </div>

              {a.freeText && (
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <p className="text-xs text-gray-400 font-medium mb-0.5">Notes</p>
                  <p className="text-sm text-gray-700">{a.freeText}</p>
                </div>
              )}
            </div>
          );
        })}
        {leads.length === 0 && (
          <p className="text-gray-400 text-sm py-12 text-center">No leads captured yet.</p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, capitalize }: { label: string; value?: string; capitalize?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
      <p className={`text-gray-800 break-words ${capitalize ? "capitalize" : ""}`}>{value || "—"}</p>
    </div>
  );
}
