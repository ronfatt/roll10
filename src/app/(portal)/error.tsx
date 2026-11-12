"use client";

import { useEffect, useState } from "react";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isZh, setIsZh] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined") {
      setIsZh(
        document.cookie.includes("bmp_locale=zh-CN") ||
          document.documentElement.lang === "zh-CN"
      );
    }
  }, []);

  return (
    <div className="rounded-2xl border border-rose-500/35 bg-[#141619] p-6 text-center">
      <h2 className="text-base font-semibold text-[#F2F0EB]">
        {isZh ? "加载出现异常" : "Something went wrong"}
      </h2>
      <p className="mt-1 text-xs text-[#A7AEBC]">
        {error.message || (isZh ? "暂时无法加载会员中心数据，请稍后重试。" : "Unable to load portal data.")}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-xl bg-[#D8B467] px-4 py-2 text-xs font-semibold text-[#111315]"
      >
        {isZh ? "重新加载" : "Retry"}
      </button>
    </div>
  );
}
