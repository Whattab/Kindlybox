"use client";

import { useRef, useState, useTransition } from "react";
import { importGiftsCsv, type ImportReport } from "./actions";
import { UploadCloud, Download, Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

// A ready-to-fill CSV: header + two valid sample rows. Array columns (tags,
// occasions, recipients) are pipe-delimited; descriptions with commas are
// quoted. Kept in sync with the columns importGiftsCsv reads.
const TEMPLATE_CSV = [
  "name,description,image_url,price_min,price_max,destination_url,affiliate_network,gender,tags,occasions,recipients,active",
  `Stanley Quencher 40oz Tumbler,"Keeps drinks ice-cold for hours, fits any cupholder.",https://example.com/tumbler.jpg,35,45,https://www.amazon.com/dp/EXAMPLE,amazon,unisex,fitness & wellness|home & kitchen,birthday|house warming,friend|co-worker,true`,
  `Hand-Bound Leather Journal,"Refillable, with thick acid-free paper.",https://example.com/journal.jpg,20,30,,amazon,unisex,books & reading|art & crafts,graduation,teacher/mentor,true`,
].join("\n");

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kindlybox-gift-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkImport() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");

  function handleSubmit(formData: FormData) {
    setError(null);
    setReport(null);
    if (mode === "replace") {
      const ok = window.confirm(
        "REPLACE MODE deletes every existing gift (and any quiz results that referenced them) before importing. This cannot be undone. Continue?"
      );
      if (!ok) return;
    }
    startTransition(async () => {
      try {
        const result = await importGiftsCsv(formData);
        setReport(result);
        if (result.imported > 0) formRef.current?.reset();
      } catch (e: any) {
        setError(e?.message || "Import failed");
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-sm text-gray-600 max-w-md">
          Upload a CSV to add many gifts at once. Prepare it in Excel or Google Sheets, then export
          as CSV. Not sure of the format? Start from the template.
        </p>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          <Download className="w-4 h-4" /> Download template
        </button>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">CSV file</label>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary/90 file:cursor-pointer"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${mode === "append" ? "border-accent bg-accent/5" : "border-gray-200 bg-gray-50"}`}>
          <input type="radio" name="mode" value="append" checked={mode === "append"} onChange={() => setMode("append")} className="mt-1 text-accent focus:ring-accent" />
          <span>
            <span className="block text-sm font-semibold text-gray-800">Add to catalog</span>
            <span className="block text-xs text-gray-500">Appends these gifts to what you already have.</span>
          </span>
        </label>
        <label className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${mode === "replace" ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
          <input type="radio" name="mode" value="replace" checked={mode === "replace"} onChange={() => setMode("replace")} className="mt-1 text-red-600 focus:ring-red-500" />
          <span>
            <span className="block text-sm font-semibold text-gray-800">Replace entire catalog</span>
            <span className="block text-xs text-gray-500">Deletes all existing gifts first. Use for a clean load.</span>
          </span>
        </label>
      </div>

      <label className="flex items-center gap-3 text-sm text-gray-700">
        <input type="checkbox" name="checkImages" defaultChecked className="rounded border-gray-300 text-accent focus:ring-accent" />
        Check each image URL loads (slower, flags broken links)
      </label>

      <div className="flex items-center justify-end pt-2 border-t border-gray-100">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
          {isPending ? "Importing…" : "Import CSV"}
        </button>
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</p>
      )}

      {report && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            Imported {report.imported} gift{report.imported === 1 ? "" : "s"}
            {report.mode === "replace" ? " (replaced the catalog)" : ""}.
          </p>

          {report.failed.length > 0 && (
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-red-700 mb-1">
                <XCircle className="w-4 h-4" /> {report.failed.length} row{report.failed.length === 1 ? "" : "s"} skipped
              </p>
              <ul className="text-xs text-red-700/90 space-y-0.5 pl-6 list-disc">
                {report.failed.map((f, i) => (
                  <li key={i}><span className="font-medium">Line {f.line} ({f.name}):</span> {f.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {report.warnings.length > 0 && (
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 mb-1">
                <AlertTriangle className="w-4 h-4" /> {report.warnings.length} warning{report.warnings.length === 1 ? "" : "s"}
              </p>
              <ul className="text-xs text-amber-700/90 space-y-0.5 pl-6 list-disc">
                {report.warnings.map((w, i) => (
                  <li key={i}><span className="font-medium">Line {w.line} ({w.name}):</span> {w.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
