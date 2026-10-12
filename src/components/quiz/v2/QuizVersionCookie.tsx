"use client";

import { useEffect } from "react";
import { QUIZ_COOKIE, type QuizVersion } from "@/lib/quiz-v2/version";

// Server components can't set cookies in Next 14, so the quiz page renders this
// to remember which version the visitor got (90 days).
export function QuizVersionCookie({ version }: { version: QuizVersion }) {
  useEffect(() => {
    document.cookie = `${QUIZ_COOKIE}=${version}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`;
  }, [version]);
  return null;
}
