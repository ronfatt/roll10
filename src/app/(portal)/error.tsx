"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw, Zap } from "lucide-react";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isZh, setIsZh] = useState(true);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const isEnglish =
        document.cookie.includes("bmp_locale=en") ||
        (document.documentElement.lang === "en" &&
          !document.cookie.includes("bmp_locale=zh-CN"));
      setIsZh(!isEnglish);
    }
  }, []);

  const rawMsg = error?.message || "";
  const isServerComponentOmission =
    rawMsg.includes("Server Components render") ||
    rawMsg.includes("digest") ||
    !rawMsg;

  const displayMessage = isServerComponentOmission
    ? isZh
      ? "会员中心数据连接超时或登录凭证已过期。请点击下方直接重新登入或刷新。"
      : "Portal data connection timed out or session expired. Please direct login or reload."
    : rawMsg;

  return (
    <div className="mx-auto my-6 max-w-lg rounded-2xl border border-[#C9A66B]/30 bg-[#141619] p-6 text-center shadow-2xl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#C9A66B]/40 bg-[#C9A66B]/10">
        <AlertTriangle className="h-6 w-6 text-[#E7C98E]" />
      </div>

      <h2 className="mt-3 text-base font-semibold text-[#F2F0EB]">
        {isZh ? "会员中心连接提醒" : "Portal Connection Notice"}
      </h2>

      <p className="mt-2 text-xs leading-relaxed text-[#A7AEBC]">
        {displayMessage}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
        <Link
          href="/login?auto=1"
          className="r10-btn-gold-3d inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 text-xs font-bold text-[#08090B] shadow-md transition-transform active:scale-[0.98]"
        >
          <Zap className="h-3.5 w-3.5 fill-current" />
          <span>{isZh ? "一键免密重新登入" : "1-Click Direct Re-login"}</span>
        </Link>

        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-4 text-xs font-medium text-[#F2F0EB] transition-colors hover:border-[#E7C98E] hover:text-[#E7C98E]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>{isZh ? "重新加载" : "Retry"}</span>
        </button>

        <Link
          href="/"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-transparent px-3 text-xs text-[#9DA4B0] hover:text-[#F2F0EB]"
        >
          <Home className="h-3.5 w-3.5" />
          <span>{isZh ? "返回首页" : "Home"}</span>
        </Link>
      </div>
    </div>
  );
}
