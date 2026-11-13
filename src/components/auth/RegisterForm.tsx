"use client";

import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Eye, EyeOff, UserCheck } from "lucide-react";
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
    <div className="w-full max-w-md rounded-2xl border border-[#29363D] bg-[#10171B] p-5 shadow-2xl sm:p-7">
      <div className="mb-5">
        <div className="mb-3.5 flex items-center justify-between">
          <Roll10Logo className="h-6 w-auto" />
          <span className="font-mono-sgt rounded-full border border-[#E9C66B]/35 bg-[#E9C66B]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#E9C66B]">
            SGT
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F4F6F7]">
          {locale === "zh-CN" ? "配套注册" : t.auth.registerTitle}
        </h1>
        <p className="mt-1 text-xs text-[#B0BBC2]">{t.auth.registerSubtitle}</p>
      </div>

      {initialRef && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-[#00D9DF]/40 bg-[#00D9DF]/10 px-3.5 py-2.5 text-xs text-[#F4F6F7]">
          <UserCheck className="h-4 w-4 shrink-0 text-[#00D9DF]" />
          <div>
            <span className="font-semibold text-[#00D9DF]">{t.auth.sponsorDetected}: </span>
            <span className="tabular-nums font-medium">
              {sponsorDisplayName ? `${sponsorDisplayName} (${initialRef})` : initialRef}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-[#F17A7A]/35 bg-[#F17A7A]/10 px-3.5 py-2.5 text-xs text-[#F17A7A]"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#F4F6F7]">
            {t.auth.sponsorCodeLabel}
          </label>
          <input
            type="text"
            required
            value={sponsorCode}
            onChange={(e) => setSponsorCode(e.target.value.toUpperCase())}
            placeholder="BM100001"
            className="min-h-[44px] w-full rounded-xl border border-[#29363D] bg-[#070B0D] px-3.5 py-2.5 text-sm uppercase text-[#F4F6F7] placeholder-[#829098]/45 outline-none focus:border-[#00D9DF]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#F4F6F7]">
            {t.auth.displayNameLabel}
          </label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={locale === "zh-CN" ? "请输入会员昵称" : "Member name"}
            className="min-h-[44px] w-full rounded-xl border border-[#29363D] bg-[#070B0D] px-3.5 py-2.5 text-sm text-[#F4F6F7] placeholder-[#829098]/45 outline-none focus:border-[#00D9DF]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#F4F6F7]">
            {t.auth.emailLabel}
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@binaryportal.io"
            className="min-h-[44px] w-full rounded-xl border border-[#29363D] bg-[#070B0D] px-3.5 py-2.5 text-sm text-[#F4F6F7] placeholder-[#829098]/45 outline-none focus:border-[#00D9DF]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#F4F6F7]">
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
              className="min-h-[44px] w-full rounded-xl border border-[#29363D] bg-[#070B0D] pl-3.5 pr-11 py-2.5 text-sm text-[#F4F6F7] placeholder-[#829098]/45 outline-none focus:border-[#00D9DF]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1 top-0.5 flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-[#829098] transition hover:text-[#F4F6F7]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Section 1: 选择配套 (Select Package) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#F4F6F7]">
              {locale === "zh-CN" ? "选择配套" : t.auth.initialPlanLabel}
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                code: "P100" as const,
                name: "Silver",
                price: "100 U",
                direct: "25%",
              },
              {
                code: "P500" as const,
                name: "Gold",
                price: "500 U",
                direct: "30%",
              },
              {
                code: "P1000" as const,
                name: "Diamond",
                price: "1,000 U",
                direct: "35%",
              },
            ].map((pkg) => {
              const selected = packageCode === pkg.code;
              return (
                <button
                  key={pkg.code}
                  type="button"
                  onClick={() => {
                    setPackageCode(pkg.code);
                    setCpAmount("0");
                  }}
                  className={`relative min-h-[72px] rounded-xl border p-2 text-center transition-all ${
                    selected
                      ? "border-[#E9C66B] bg-[#172126] text-[#F4F6F7] shadow-[0_0_12px_rgba(233,198,107,0.25)]"
                      : "border-[#29363D] bg-[#070B0D] text-[#B0BBC2] hover:border-[#29363D]/80"
                  }`}
                >
                  {selected && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#E9C66B] text-[#070B0D] shadow">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  )}
                  <div className="text-xs font-black italic tracking-wide text-[#E9C66B]">
                    {pkg.name}
                  </div>
                  <div className="tabular-nums text-sm font-bold text-[#F4F6F7]">
                    {pkg.price}
                  </div>
                  <div className="tabular-nums text-[11px] font-semibold text-[#829098]">
                    {pkg.direct}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="text-[10.5px] text-[#829098]">
            {locale === "zh-CN" ? "① 自身配套对应直推比例" : "① Rate determined by own active tier"}
          </div>
        </div>

        {/* Section 2: 支付明细 (Payment Breakdown) */}
        {submitPaymentNow && (
          <div className="rounded-xl border border-[#29363D] bg-[#070B0D] p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#B0BBC2]">{locale === "zh-CN" ? "配套金额" : "Package Price"}</span>
              <span className="font-bold text-[#F4F6F7] tabular-nums">{packagePrice} U</span>
            </div>

            {/* RP Display */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#B0BBC2]">
                {locale === "zh-CN" ? "Register Point" : "Register Point"}
              </span>
              <span className="font-bold tabular-nums text-[#00D9DF]">{fixedRp} RP</span>
            </div>

            {/* CP Input with interactive slider */}
            <div className="space-y-1.5 border-t border-[#29363D]/60 pt-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#B0BBC2]">{locale === "zh-CN" ? "Cash Point" : "Cash Point"}</span>
                <button
                  type="button"
                  onClick={() => setCpAmount(String(maxCp))}
                  className="font-bold text-[#E9C66B] hover:underline tabular-nums"
                >
                  {numCp} CP
                </button>
              </div>

              {/* Slider 0% to 50% */}
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max={maxCp}
                  step="1"
                  value={numCp}
                  onChange={(e) => setCpAmount(e.target.value)}
                  className="r10-slider w-full"
                />
                <div className="flex justify-between text-[10px] text-[#829098]">
                  <span>0%</span>
                  <button
                    type="button"
                    onClick={() => setCpAmount(String(maxCp))}
                    className="text-[#00D9DF] hover:underline font-semibold"
                  >
                    {locale === "zh-CN" ? "最大可用 (50%)" : "Max (50%)"}
                  </button>
                  <span>50%</span>
                </div>
              </div>
            </div>

            {/* Remaining USDT */}
            <div className="flex items-center justify-between border-t border-[#29363D]/60 pt-2.5 text-xs">
              <span className="text-[#B0BBC2]">
                {locale === "zh-CN" ? "USDT 补足" : "USDT Remainder"}
              </span>
              <span className="text-sm font-bold tabular-nums text-[#52C898]">
                {remainingUsdt} USDT
              </span>
            </div>

            {/* Footnotes */}
            <div className="space-y-1 border-t border-[#29363D]/60 pt-2 text-[10.5px] text-[#829098] leading-tight">
              <div>① 固定 50% RP，CP 可选 0–50%，其余 USDT 补足。</div>
              <div>② RP 由公司出售。</div>
            </div>
          </div>
        )}

        {/* Action Button: 确认注册 (Solid Champagne Gold Button) */}
        <button
          type="submit"
          disabled={loading}
          className="r10-btn-gold flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-[#070B0D] transition-all disabled:opacity-50"
        >
          <span>{loading ? t.common.loading : (locale === "zh-CN" ? "确认注册" : t.auth.registerBtn)}</span>
          <ArrowRight className="h-4 w-4 stroke-[2.5]" />
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-[#829098]">
        {t.auth.hasAccount}{" "}
        <Link href="/login" className="font-semibold text-[#00D9DF] hover:underline">
          {t.auth.signInBtn}
        </Link>
      </p>
    </div>
  );
}
