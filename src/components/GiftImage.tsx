"use client";

import Image from "next/image";
import { Gift } from "lucide-react";
import { useState } from "react";

// Renders a gift image that NEVER crashes the page: a missing src, a broken
// link, or a non-image URL (e.g. an Amazon product page pasted by mistake)
// all degrade gracefully to a placeholder instead of throwing during render.
export function GiftImage({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/10">
        <Gift className="w-10 h-10 text-accent/40" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
      onError={() => setFailed(true)}
    />
  );
}
