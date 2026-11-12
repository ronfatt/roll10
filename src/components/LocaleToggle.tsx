"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import type { Locale } from "@/lib/i18n";

export function LocaleToggle({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const nextLocale: Locale = locale === "en" ? "zh-CN" : "en";
    startTransition(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label="Toggle language"
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-[#D4AF37]/50 hover:text-[#E5C158] disabled:opacity-50"
    >
      <Globe className="h-3.5 w-3.5 text-[#D4AF37]" />
      <span>{locale === "en" ? "EN / 中文" : "中文 / EN"}</span>
    </button>
  );
}
