// "Did you mean …@gmail.com?" — catches common email-domain slips so a quiz
// email doesn't bounce (the owner's own test typed "@gmail.col"). Suggest only;
// never block submitting, since an unusual domain may be real.

const KNOWN: Record<string, string> = {
  // gmail
  "gmail.col": "gmail.com", "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "gmail.co": "gmail.com",
  "gmail.om": "gmail.com", "gmail.comm": "gmail.com", "gmail.cmo": "gmail.com", "gmail.vom": "gmail.com",
  "gmial.com": "gmail.com", "gamil.com": "gmail.com", "gnail.com": "gmail.com", "gmal.com": "gmail.com",
  "gmaill.com": "gmail.com", "gmai.com": "gmail.com", "gmail.c": "gmail.com",
  // hotmail / outlook
  "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com", "hotmail.col": "hotmail.com",
  "outlok.com": "outlook.com", "outloo.com": "outlook.com", "outlook.co": "outlook.com", "outlook.con": "outlook.com",
  // yahoo
  "yahooo.com": "yahoo.com", "yaho.com": "yahoo.com", "yahoo.co": "yahoo.com", "yahoo.con": "yahoo.com", "yahoo.col": "yahoo.com",
  // others
  "icloud.co": "icloud.com", "icloud.con": "icloud.com", "icoud.com": "icloud.com",
  "aol.co": "aol.com", "aol.con": "aol.com",
};

export function suggestEmailFix(email: string): string | null {
  const e = (email || "").trim();
  const at = e.lastIndexOf("@");
  if (at < 1 || at === e.length - 1) return null;
  const domain = e.slice(at + 1).toLowerCase();
  const fixed = KNOWN[domain];
  return fixed ? `${e.slice(0, at)}@${fixed}` : null;
}

/** Loose shape check, same spirit as the quiz's existing "@" check. */
export const looksLikeEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || "").trim());
