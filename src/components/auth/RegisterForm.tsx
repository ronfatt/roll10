"use client";

import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, UserCheck } from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Roll10Logo } from "@/components/Roll10Logo";

export function RegisterForm({
  t,
  locale = "en",
  initialRef,
  sponsorDisplayName,
}: {
  t: Dictionary;
  locale?: Locale;
  initialRef?: string;
  sponsorDisplayName?: string | null;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sponsorCode, setSponsorCode] = useState(initialRef || "");
  const [packageCode, setPackageCode] = useState<"P100" | "P500" | "P1000">("P500");
  const [cpAmount, setCpAmount] = useState<string>("0");
  const [submitPaymentNow, setSubmitPaymentNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);

  const packagePrice = packageCode === "P100" ? 100 : packageCode === "P500" ? 500 : 1000;
  const fixedRp = packagePrice * 0.5;
  const maxCp = packagePrice * 0.5;
  const numCp = Math.max(0, Math.min(maxCp, Number(cpAmount) || 0));
  const remainingUsdt = Math.max(0, fixedRp - numCp);
  const cpPercent = Math.round((numCp / packagePrice) * 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          email,
          password,
          sponsorCode,
          packageCode: submitPaymentNow ? packageCode : undefined,
          cpAmountU: submitPaymentNow ? numCp : undefined,
          payImmediatelyDemo: false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || (locale === "zh-CN" ? "注册失败" : "Registration failed"));
        setLoading(false);
        inFlightRef.current = false;
        return;
      }

      const signInRes = await signIn("credentials", {
        identifier: email,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        router.push("/login");
        return;
      }
      router.push(data.order?.id ? `/orders/${data.order.id}` : "/dashboard");
      router.refresh();
    } catch {
      setError(locale === "zh-CN" ? "注册时网络异常，请重试" : "Network error while registering");
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#141619] p-6 shadow-2xl sm:p-8">
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <Roll10Logo className="h-6 w-auto" />
          <span className="font-mono-sgt rounded-full border border-[#CBB487]/35 bg-[#CBB487]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#CBB487]">
            SGT
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F2F0EB]">
          {t.auth.registerTitle}
        </h1>
        <p className="mt-1 text-sm text-[#A7AEBC]">{t.auth.registerSubtitle}</p>
      </div>

      {initialRef && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-[#CBB487]/40 bg-[#CBB487]/10 px-3.5 py-2.5 text-xs text-[#F2F0EB]">
          <UserCheck className="h-4 w-4 shrink-0 text-[#CBB487]" />
          <div>
            <span className="font-semibold text-[#CBB487]">{t.auth.sponsorDetected}: </span>
            <span className="tabular-nums font-medium">
              {sponsorDisplayName ? `${sponsorDisplayName} (${initialRef})` : initialRef}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#F2F0EB]">
            {t.auth.sponsorCodeLabel}
          </label>
          <input
            type="text"
            required
            value={sponsorCode}
            onChange={(e) => setSponsorCode(e.target.value.toUpperCase())}
            placeholder="BM100002"
            className="min-h-[44px] w-full rounded-xl border border-white/[0.1] bg-[#08090B] px-3.5 py-2.5 text-sm uppercase text-[#F2F0EB] placeholder-[#A7AEBC]/45 outline-none focus:border-[#CBB487]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#F2F0EB]">
            {t.auth.displayNameLabel}
          </label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={locale === "zh-CN" ? "请输入会员昵称或姓名" : "Full name"}
            className="min-h-[44px] w-full rounded-xl border border-white/[0.1] bg-[#08090B] px-3.5 py-2.5 text-sm text-[#F2F0EB] placeholder-[#A7AEBC]/45 outline-none focus:border-[#CBB487]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#F2F0EB]">
            {t.auth.emailLabel}
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className="min-h-[44px] w-full rounded-xl border border-white/[0.1] bg-[#08090B] px-3.5 py-2.5 text-sm text-[#F2F0EB] placeholder-[#A7AEBC]/45 outline-none focus:border-[#CBB487]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#F2F0EB]">
            {t.auth.passwordLabel}
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={locale === "zh-CN" ? "至少 6 位字符" : "Min 6 characters"}
              className="min-h-[44px] w-full rounded-xl border border-white/[0.1] bg-[#08090B] pl-3.5 pr-11 py-2.5 text-sm text-[#F2F0EB] placeholder-[#A7AEBC]/45 outline-none focus:border-[#CBB487]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword
                  ? locale === "zh-CN"
                    ? "隐藏密码"
                    : "Hide password"
                  : locale === "zh-CN"
                    ? "显示密码"
                    : "Show password"
              }
              className="absolute right-1 top-0.5 flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-[#A7AEBC] transition hover:text-[#F2F0EB]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#F2F0EB]">
            {t.auth.initialPlanLabel}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                code: "P100" as const,
                price: "100 U",
                points: locale === "zh-CN" ? "100 积分" : "100 pts",
                direct: "25%",
                cap: "100 CP",
              },
              {
                code: "P500" as const,
                price: "500 U",
                points: locale === "zh-CN" ? "500 积分" : "500 pts",
                direct: "30%",
                cap: "500 CP",
              },
              {
                code: "P1000" as const,
                price: "1,000 U",
                points: locale === "zh-CN" ? "1,000 积分" : "1,000 pts",
                direct: "35%",
                cap: "1,000 CP",
              },
            ].map((pkg) => (
              <button
                key={pkg.code}
                type="button"
                onClick={() => {
                  setPackageCode(pkg.code);
                  setCpAmount("0");
                }}
                className={`min-h-[72px] rounded-xl border p-2 text-left transition ${
                  packageCode === pkg.code
                    ? "border-[#51E7FA] bg-[#51E7FA]/15 text-[#F2F0EB]"
                    : "border-white/[0.08] bg-[#08090B] text-[#A7AEBC] hover:border-[#51E7FA]/40"
                }`}
              >
                <div className="tabular-nums text-xs font-bold text-[#F2CD7E]">
                  {pkg.price}
                </div>
                <div className="tabular-nums text-[11px] font-medium text-[#F2F0EB]">
                  {pkg.points}
                </div>
                <div className="tabular-nums text-[10px] text-[#51E7FA]">
                  {locale === "zh-CN" ? `直推 ${pkg.direct}` : `Dir ${pkg.direct}`}
                </div>
                <div className="tabular-nums text-[9.5px] text-[#A7AEBC]">
                  {locale === "zh-CN" ? `封顶 ${pkg.cap}` : `Cap ${pkg.cap}`}
                </div>
              </button>
            ))}
          </div>
        </div>

        {submitPaymentNow && (
          <div className="rounded-xl border border-white/[0.1] bg-[#0E1722]/80 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#CAD7E6]">
                {locale === "zh-CN" ? "支付组合明细" : "Payment Breakdown"}
              </span>
              <span className="rounded bg-[#51E7FA]/15 px-2 py-0.5 text-[10px] font-bold text-[#51E7FA]">
                {locale === "zh-CN" ? `总额 ${packagePrice} U` : `Total ${packagePrice} U`}
              </span>
            </div>

            {/* RP Display */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#AAB8C7]">
                {locale === "zh-CN" ? "固定 50% RP：" : "Fixed 50% RP:"}
              </span>
              <span className="font-bold tabular-nums text-[#F2CD7E]">{fixedRp} RP</span>
            </div>

            {/* CP Input with Max Button */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-[#CAD7E6]">
                  {locale === "zh-CN" ? "自选抵扣 CP (0%–50%)" : "Optional CP (0%–50%)"}
                </label>
                <button
                  type="button"
                  onClick={() => setCpAmount(String(maxCp))}
                  className="text-[10.5px] font-semibold text-[#51E7FA] hover:underline"
                >
                  {locale === "zh-CN" ? "使用最大可用 CP" : "Use Max CP"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max={maxCp}
                  step="1"
                  value={cpAmount}
                  onChange={(e) => setCpAmount(e.target.value)}
                  className="min-h-[40px] flex-1 rounded-xl border border-white/[0.1] bg-[#08090B] px-3 text-xs text-[#F2F0EB] tabular-nums outline-none focus:border-[#51E7FA]"
                />
                <span className="rounded-lg border border-[#51E7FA]/30 bg-[#51E7FA]/10 px-2.5 py-2 text-xs font-bold text-[#51E7FA] tabular-nums">
                  {cpPercent}% CP
                </span>
              </div>
            </div>

            {/* Remaining USDT */}
            <div className="flex items-center justify-between border-t border-white/[0.08] pt-2 text-xs">
              <span className="text-[#CAD7E6]">
                {locale === "zh-CN" ? "剩余补足 USDT：" : "Payable USDT remainder:"}
              </span>
              <span className="text-sm font-black tabular-nums text-[#51E7FA]">
                {remainingUsdt} USDT
              </span>
            </div>

            <p className="text-[10px] text-[#889AA8] leading-relaxed">
              💡 {locale === "zh-CN"
                ? "说明：CP 最高抵扣配套金额的 50%。1 RP = 1 U，1 CP = 1 U。"
                : "Notice: CP offsets max 50% of package. 1 RP = 1 U, 1 CP = 1 U."}
            </p>
          </div>
        )}

        <label className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#08090B] px-3 py-2 text-xs text-[#D6D3CC]">
          <input
            type="checkbox"
            checked={submitPaymentNow}
            onChange={(e) => setSubmitPaymentNow(e.target.checked)}
            className="h-4 w-4 accent-[#51E7FA]"
          />
          <span>{t.auth.confirmOrderOnSignup}</span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#CBB487] px-4 py-2.5 text-sm font-semibold text-[#08090B] transition-all duration-100 hover:bg-[#D8C49B] active:scale-[0.98] disabled:opacity-50"
        >
          <span>{loading ? t.common.loading : t.auth.registerBtn}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-[#A7AEBC]">
        {t.auth.hasAccount}{" "}
        <Link href="/login" className="font-medium text-[#CBB487] hover:underline">
          {t.auth.signInBtn}
        </Link>
      </p>
    </div>
  );
}
