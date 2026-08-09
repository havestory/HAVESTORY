import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  text: string;
  label?: string;
  size?: "sm" | "md";
}

export function CopyButton({ text, label, size = "sm" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 rounded-lg border transition-all font-semibold
        ${size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs"}
        ${copied
          ? "border-green-300 bg-green-50 text-green-600"
          : "border-gray-200 text-gray-600 hover:border-pink-300 hover:text-pink-600"
        }`}
    >
      {copied ? <Check size={size === "md" ? 14 : 12} className="text-green-500" /> : <Copy size={size === "md" ? 14 : 12} />}
      {copied ? "Copied!" : label ? `Copy ${label}` : "Copy"}
    </button>
  );
}
