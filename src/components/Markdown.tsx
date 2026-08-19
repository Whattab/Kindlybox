import Link from "next/link";
import type { ReactNode } from "react";

// A deliberately small markdown renderer for article bodies.
//
// It renders to real React elements — never dangerouslySetInnerHTML — so AI or
// pasted copy can't inject markup into the page. It covers what the article
// editor actually produces: ## / ### headings, bullet and numbered lists,
// blockquotes, paragraphs, **bold**, *italic*, `code` and [links](url).

// ---- inline ---------------------------------------------------------------

// Order matters: links first (their text may contain emphasis markers).
const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;

  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${m.index}`;
    const [, linkText, href, bold, italic, code] = m;

    if (linkText && href) {
      const internal = href.startsWith("/");
      out.push(
        internal ? (
          <Link key={key} href={href} className="text-accent font-semibold hover:underline">
            {linkText}
          </Link>
        ) : (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="text-accent font-semibold hover:underline"
          >
            {linkText}
          </a>
        ),
      );
    } else if (bold) {
      out.push(<strong key={key} className="font-semibold text-primary">{bold}</strong>);
    } else if (italic) {
      out.push(<em key={key}>{italic}</em>);
    } else if (code) {
      out.push(<code key={key} className="text-[0.9em] bg-gray-100 rounded px-1 py-0.5">{code}</code>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ---- blocks ---------------------------------------------------------------

const isBullet = (l: string) => /^\s*[-*]\s+/.test(l);
const isNumbered = (l: string) => /^\s*\d+[.)]\s+/.test(l);
const stripMarker = (l: string) => l.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "");

export function Markdown({ children }: { children: string }) {
  // Split on blank lines, then classify each block by its first line.
  const blocks = (children || "").replace(/\r\n/g, "\n").split(/\n{2,}/);

  return (
    <div className="space-y-5">
      {blocks.map((raw, bi) => {
        const block = raw.trim();
        if (!block) return null;
        const lines = block.split("\n");
        const first = lines[0];

        if (/^###\s+/.test(first)) {
          return (
            <h3 key={bi} className="font-serif text-xl font-bold text-primary pt-2">
              {inline(first.replace(/^###\s+/, ""), `h3-${bi}`)}
            </h3>
          );
        }
        if (/^##\s+/.test(first)) {
          return (
            <h2 key={bi} className="font-serif text-2xl sm:text-3xl font-bold text-primary pt-4">
              {inline(first.replace(/^##\s+/, ""), `h2-${bi}`)}
            </h2>
          );
        }
        if (/^#\s+/.test(first)) {
          return (
            <h2 key={bi} className="font-serif text-3xl font-bold text-primary pt-4">
              {inline(first.replace(/^#\s+/, ""), `h1-${bi}`)}
            </h2>
          );
        }
        if (first.startsWith(">")) {
          return (
            <blockquote key={bi} className="border-l-4 border-accent/40 bg-accent/5 rounded-r-xl px-5 py-3 text-gray-700 italic">
              {inline(lines.map((l) => l.replace(/^>\s?/, "")).join(" "), `q-${bi}`)}
            </blockquote>
          );
        }
        if (isBullet(first)) {
          return (
            <ul key={bi} className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed marker:text-accent">
              {lines.filter(isBullet).map((l, li) => (
                <li key={li}>{inline(stripMarker(l), `ul-${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        if (isNumbered(first)) {
          return (
            <ol key={bi} className="list-decimal pl-6 space-y-2 text-gray-700 leading-relaxed marker:text-accent marker:font-semibold">
              {lines.filter(isNumbered).map((l, li) => (
                <li key={li}>{inline(stripMarker(l), `ol-${bi}-${li}`)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={bi} className="text-gray-700 leading-relaxed">
            {inline(lines.join(" "), `p-${bi}`)}
          </p>
        );
      })}
    </div>
  );
}
