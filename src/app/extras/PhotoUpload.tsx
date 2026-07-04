"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { createBuyerUploadUrl } from "./actions";
import { ASSET_BUCKET } from "@/lib/extras";
import { ImagePlus, Loader2, X } from "lucide-react";

// Buyer-facing: upload one or more photos to include in the card. Each uploaded
// photo's URL is emitted as a hidden input so it submits with the order form.
export function PhotoUpload() {
  const [urls, setUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      for (const file of files) {
        const { path, token, publicUrl } = await createBuyerUploadUrl(file.name);
        const { error: upErr } = await supabase.storage.from(ASSET_BUCKET).uploadToSignedUrl(path, token, file);
        if (upErr) throw upErr;
        setUrls((prev) => [...prev, publicUrl]);
      }
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  const remove = (u: string) => setUrls((prev) => prev.filter((x) => x !== u));

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Photos to include (optional)</label>

      {urls.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-3">
          {urls.map((u) => (
            <div key={u} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="reference" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => remove(u)}
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black"
                title="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              {/* Submits with the order form */}
              <input type="hidden" name="reference_photos" value={u} />
            </div>
          ))}
        </div>
      )}

      <label className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-2.5 cursor-pointer hover:bg-gray-100 transition-colors text-sm text-gray-600">
        <input type="file" accept="image/*" multiple onChange={handleFiles} disabled={busy} className="hidden" />
        {busy ? <Loader2 className="w-5 h-5 text-accent animate-spin" /> : <ImagePlus className="w-5 h-5 text-gray-400" />}
        {busy ? "Uploading…" : "Add photo(s)"}
      </label>
      <p className="text-xs text-gray-400 mt-1">A person, place, pet — anything you&apos;d like on the card. JPG/PNG.</p>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
