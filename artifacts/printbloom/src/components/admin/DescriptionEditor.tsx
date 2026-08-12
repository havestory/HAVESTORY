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
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100">
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
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
        className="w-full resize-y bg-white px-4 py-3 text-sm leading-relaxed text-gray-800 outline-none placeholder:text-gray-400"
      />
      <p className="border-t border-gray-100 px-3 py-2 text-[10px] text-gray-400">
        Plain text is stored safely; line breaks are preserved on the website.
      </p>
    </div>
  );
}

