"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

export function ShareButtons({ shareLink }: { shareLink: string }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy share link", error);
    }
  };

  return (
    <button
      type="button"
      onClick={copyLink}
      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:text-accent"
    >
      {copied ? <Check className="h-4 w-4 text-accent" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Copied" : "Share link"}
    </button>
  );
}
