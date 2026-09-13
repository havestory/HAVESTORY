import { useEffect, useState } from "react";

export function DescriptionEditor({
  value,
  onChange,
  placeholder,
  minHeight = 140,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const [draft, setDraft] = useState(value || "");

  useEffect(() => setDraft(value || ""), [value]);

  return (
    <div className="overflow-hidden rounded-xl border border-admin-border bg-admin-surface focus-within:border-admin-warning-line focus-within:ring-2 focus-within:ring-admin-warning">
      <div className="border-b border-admin-border bg-admin-surface px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-admin-muted">
        Description
      </div>
      <textarea
        value={draft}
        onChange={event => {
          const next = event.target.value;
          setDraft(next);
          onChange(next);
        }}
        placeholder={placeholder || "Describe this item…"}
        style={{ minHeight }}
        className="w-full resize-y bg-admin-surface px-4 py-3 text-sm leading-relaxed text-admin-ink outline-none placeholder:text-admin-muted"
      />
      <p className="border-t border-admin-border px-3 py-2 text-[10px] text-admin-muted">
        Plain text is stored safely; line breaks are preserved on the website.
      </p>
    </div>
  );
}

