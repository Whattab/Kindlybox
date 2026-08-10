"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";
import { createAssetUploadUrl, saveAssetUrl, deleteAsset } from "./actions";
import { ASSET_BUCKET } from "@/lib/extras";
import { UploadCloud, Loader2, CheckCircle2, Download, Trash2 } from "lucide-react";

export function AssetUpload({
  orderId,
  type,
  label,
  hint,
  accept,
  currentUrl,
}: {
  orderId: string;
  type: "song" | "card";
  label: string;
  hint: string;
  accept: string;
  currentUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(currentUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const handleRemove = () => {
    setError(null);
    if (!window.confirm(`Remove the uploaded ${type}? This deletes the file — the order stays.`)) return;
    startDelete(async () => {
      try {
        await deleteAsset(orderId, type);
        setUrl("");
      } catch (e: any) {
        setError(e?.message || "Could not remove the file");
      }
    });
  };

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      // 1. Ask the server for a one-time signed upload URL.
      const { path, token } = await createAssetUploadUrl(orderId, type, file.name);
      // 2. Upload the file straight to Supabase Storage from the browser.
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from(ASSET_BUCKET).uploadToSignedUrl(path, token, file);
      if (upErr) throw upErr;
      // 3. Record the resulting public URL on the order.
      const publicUrl = await saveAssetUrl(orderId, type, path);
      setUrl(publicUrl);
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const downloadHref = url ? `${url}?download` : "";

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>

      {url && (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          {type === "song" ? (
            <audio controls src={url} className="w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="card preview" className="max-h-40 rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div className="mt-2 flex items-center gap-4">
            <a href={downloadHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline">
              <Download className="w-4 h-4" /> Current file (download)
            </a>
            <button
              type="button"
              onClick={handleRemove}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Remove
            </button>
          </div>
        </div>
      )}

      <label className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors">
        <input ref={inputRef} type="file" accept={accept} onChange={handleFile} disabled={busy} className="hidden" />
        {busy ? <Loader2 className="w-5 h-5 text-accent animate-spin" /> : url ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <UploadCloud className="w-5 h-5 text-gray-400" />}
        <span className="text-sm text-gray-600">{busy ? "Uploading…" : url ? "Replace file" : "Choose a file to upload"}</span>
      </label>
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
