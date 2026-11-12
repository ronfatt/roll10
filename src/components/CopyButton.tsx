"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-medium text-[#E5C158] transition hover:bg-[#D4AF37]/20"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}
