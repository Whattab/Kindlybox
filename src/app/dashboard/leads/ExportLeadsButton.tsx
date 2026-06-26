"use client";

import { Download } from "lucide-react";

type Lead = {
  email_captured: string | null;
  first_name_captured: string | null;
  created_at: string;
  answers: any;
};

const COLUMNS = [
  "Date", "Name", "Email", "Occasion", "Recipient", "Recipient Name",
  "Budget", "Gender", "Age Group", "Interests", "Notes",
];

// Wrap a value so commas, quotes and newlines survive in a CSV cell.
function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function toRow(lead: Lead): string {
  const a = lead.answers || {};
  return [
    new Date(lead.created_at).toLocaleString(),
    lead.first_name_captured,
    lead.email_captured,
    a.occasion,
    a.recipient,
    a.recipientName,
    a.budget,
    a.gender,
    a.ageGroup,
    Array.isArray(a.interests) ? a.interests.join("; ") : a.interests,
    a.freeText,
  ].map(csvCell).join(",");
}

export function ExportLeadsButton({ leads }: { leads: Lead[] }) {
  const handleExport = () => {
    const csv = [
      COLUMNS.map(csvCell).join(","),
      ...leads.map(toRow),
    ].join("\r\n");

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kindlybox-leads-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      disabled={leads.length === 0}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download className="w-4 h-4" /> Export CSV
    </button>
  );
}
