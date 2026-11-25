// Allow-list HTML sanitizer for rich text in plan pages. Works in Node (no DOMParser).
// Keeps b, strong, br, ul, ol, li, p, div, span (only class="acc"); other tags are dropped (their text kept),
// every attribute is removed, and all other text is escaped. Running it twice gives the same result.
const OK = new Set(["b", "strong", "br", "ul", "ol", "li", "p", "div", "span"]);
const esc = (s: string) =>
  s.replace(/&(?!(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function sanitize(html: string): string {
  let out = "", last = 0;
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  for (let m; (m = re.exec(html)); ) {
    out += esc(html.slice(last, m.index));
    last = re.lastIndex;
    const [, close, raw, attrs] = m, tag = raw.toLowerCase();
    if (!OK.has(tag)) continue;
    if (close) { if (tag !== "br") out += `</${tag}>`; continue; }
    const acc = tag === "span" && /(?:^|\s)class\s*=\s*(["']?)acc\1(?=\s|\/|$)/i.test(attrs);
    out += acc ? '<span class="acc">' : `<${tag}>`;
  }
  return out + esc(html.slice(last));
}
