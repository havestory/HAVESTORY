import { useMemo } from "react";
import DOMPurify from "dompurify";
import {
  looksLikeHtml,
  parseDescriptionLines,
} from "@/lib/description-utils";

/**
 * Renders a stored product/service description.
 *
 * - Empty / whitespace-only → renders nothing.
 * - HTML (rich text) → sanitised with DOMPurify and rendered with Tailwind
 *   typography styling.
 * - Legacy plain text with `\n` line breaks → split into paragraphs (or a
 *   single paragraph if there's only one non-empty line) so existing data
 *   keeps rendering correctly.
 *
 * Backward-compatible with all existing description data.
 */
export function DescriptionDisplay({
  value,
  className = "",
  paragraphClassName = "",
  /** @deprecated retained for callers — list/icon styling now comes from prose */
  listClassName = "",
  /** @deprecated retained for callers */
  itemClassName = "",
  /** @deprecated retained for callers */
  iconClassName = "",
  /** @deprecated retained for callers */
  iconSize: _iconSize,
}: {
  value: string | null | undefined;
  className?: string;
  paragraphClassName?: string;
  listClassName?: string;
  itemClassName?: string;
  iconClassName?: string;
  iconSize?: number;
}) {
  const sanitised = useMemo(() => {
    if (!value) return "";
    if (looksLikeHtml(value)) {
      return DOMPurify.sanitize(value, {
        ALLOWED_TAGS: [
          "p",
          "br",
          "strong",
          "em",
          "u",
          "s",
          "h1",
          "h2",
          "h3",
          "ul",
          "ol",
          "li",
          "a",
          "blockquote",
          "code",
          "span",
        ],
        ALLOWED_ATTR: ["href", "target", "rel", "style", "class"],
        ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/)/i,
      });
    }
    return "";
  }, [value]);

  if (!value) return null;

  // Suppress unused-prop warning while preserving callers
  void listClassName;
  void itemClassName;
  void iconClassName;
  void _iconSize;

  if (sanitised) {
    return (
      <div
        className={`prose prose-sm max-w-none ${className}`.trim()}
        // Sanitised above with DOMPurify. Allowed tags are limited to
        // formatting + links (https/mailto/tel only).
        dangerouslySetInnerHTML={{ __html: sanitised }}
      />
    );
  }

  // Legacy plain-text path. Split on \n; render single line as <p>, multiple
  // lines as a list of paragraphs (preserves admin-entered ordering without
  // forcing a bulleted style on existing content).
  const lines = parseDescriptionLines(value);
  if (lines.length === 0) return null;
  if (lines.length === 1) {
    return (
      <p className={`${className} ${paragraphClassName}`.trim()}>{lines[0]}</p>
    );
  }
  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {lines.map((line, i) => (
        <p key={i} className={paragraphClassName}>
          {line}
        </p>
      ))}
    </div>
  );
}

/**
 * Truncated, single-line summary version for list / card UIs that don't have
 * room for the full layout. Picks the first non-empty line of the description
 * (HTML or plain text), with all formatting stripped.
 */
export function DescriptionSummary({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const [first] = parseDescriptionLines(value, 1);
  if (!first) return null;
  return <p className={className}>{first}</p>;
}
