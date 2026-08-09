/**
 * Pure utility helpers for product / service description handling.
 *
 * Kept in `lib/` (no React, no TipTap, no DOMPurify) so that storefront /
 * non-admin code can import them without pulling the whole rich-text-editor
 * stack into the public bundle. The TipTap-based `DescriptionEditor` lives
 * separately under `components/admin/`.
 */

/**
 * Heuristic: does this string look like rich-text HTML rather than plain text?
 *
 * We look for the structural / formatting tags we actually emit and accept
 * (`<p>`, `<h1-6>`, lists, basic inline marks). This means a plain text
 * description that just happens to contain something like `<3` won't be
 * misclassified as HTML.
 */
export function looksLikeHtml(value: string | null | undefined): boolean {
  if (!value) return false;
  return /<\/?(p|h[1-6]|ul|ol|li|strong|em|u|s|a|br|blockquote|span|div)(\s|>)/i.test(
    value,
  );
}

/**
 * Convert any stored description into the HTML the rich editor expects.
 *
 * - HTML (already rich) → returned as-is.
 * - Plain text with `\n` line breaks (legacy) → each non-empty line wrapped
 *   in a `<p>` so it round-trips losslessly into the editor.
 * - Empty / undefined → empty string (renders the placeholder).
 */
export function normalizeForEditor(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw);
  if (looksLikeHtml(s)) return s;
  const parts = s.replace(/\r\n?/g, "\n").split("\n");
  return parts
    .map(line => {
      const t = line.trim();
      if (!t) return "<p></p>";
      return `<p>${escapeHtml(t)}</p>`;
    })
    .join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Plain-text projection of a stored description. HTML tags are stripped and
 * each block-level element (paragraphs, list items, headings, blockquotes)
 * becomes its own line.
 *
 * Used by list / card teasers that don't have room for the full rich render —
 * admin product/service tables, ProductCard, the cart drawer, etc. Caps at
 * `max` lines if provided.
 */
export function parseDescriptionLines(
  value: string | null | undefined,
  max?: number,
): string[] {
  if (!value) return [];
  const s = String(value);
  if (!looksLikeHtml(s)) {
    const lines = s
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);
    return typeof max === "number" ? lines.slice(0, max) : lines;
  }
  const blocks: string[] = [];
  const blockRe = /<(p|li|h[1-6]|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(s)) !== null) {
    const text = stripTags(m[2]).trim();
    if (text) blocks.push(text);
  }
  if (blocks.length === 0) {
    const text = stripTags(s);
    blocks.push(...text.split("\n").map(l => l.trim()).filter(Boolean));
  }
  return typeof max === "number" ? blocks.slice(0, max) : blocks;
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h[1-6]|blockquote|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
