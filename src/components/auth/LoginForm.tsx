"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Sparkles, UserCheck, Zap } from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Roll10Logo } from "@/components/Roll10Logo";
import { MarbleRaceLoader } from "@/components/MarbleRaceLoader";
import { DEFAULT_DIRECT_LOGIN_ACCOUNT, DIRECT_LOGIN_ENABLED } from "@/lib/app-config";

export function LoginForm({
  t,
  locale = "en",
}: {
  t: Dictionary;
  locale?: Locale;
}) {
  const router = useRouter();
  const isZh = locale === "zh-CN";

  const [identifier, setIdentifier] = useState(
    DIRECT_LOGIN_ENABLED ? DEFAULT_DIRECT_LOGIN_ACCOUNT.admin.identifier : ""
  );
  const [password, setPassword] = useState(
    DIRECT_LOGIN_ENABLED ? DEFAULT_DIRECT_LOGIN_ACCOUNT.admin.password : ""
  );
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const [showRaceLoader, setShowRaceLoader] = useState(false);
  const inFlightRef = useRef(false);

  const executeSignIn = async (idToUse: string, passToUse: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        identifier: idToUse.trim(),
        password: passToUse,
        redirect: false,
      });
      if (res?.error) {
        setError(t.auth.invalidCredentials);
        setLoading(false);
        setAutoLoggingIn(false);
        inFlightRef.current = false;
        return;
      }
      setShowRaceLoader(true);
    } catch {
      setError(t.auth.signInFailed);
      setLoading(false);
      setAutoLoggingIn(false);
      inFlightRef.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSignIn(identifier, password);
  };

  const handleQuickLogin = async (type: "admin" | "member") => {
    const acc = DEFAULT_DIRECT_LOGIN_ACCOUNT[type];
    setIdentifier(acc.identifier);
    setPassword(acc.password);
    await executeSignIn(acc.identifier, acc.password);
  };

  // Support ?auto=1 or ?direct=1 to seamlessly trigger login without any manual click
  useEffect(() => {
    if (!DIRECT_LOGIN_ENABLED) return;
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("auto") === "1" || sp.get("direct") === "1") {
      setAutoLoggingIn(true);
      const requestedRole = sp.get("role");
      const acc =
        requestedRole === "member"
          ? DEFAULT_DIRECT_LOGIN_ACCOUNT.member
          : DEFAULT_DIRECT_LOGIN_ACCOUNT.admin;
      setIdentifier(acc.identifier);
      setPassword(acc.password);
      void executeSignIn(acc.identifier, acc.password);
    }
  }, []);

  if (showRaceLoader) {
    return (
      <MarbleRaceLoader
        locale={locale}
        targetHref="/dashboard"
        onComplete={() => {
          router.replace("/dashboard");
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#141619] p-6 shadow-2xl sm:p-8">
      <div className="mb-6">
        <div className="mb-5 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#9DA4B0] hover:text-[#E7C98E]">
            <ArrowLeft className="h-3.5 w-3.5" />
            <Roll10Logo className="h-6 w-auto" />
          </Link>
          <span className="font-mono-sgt rounded-full border border-[#CBB487]/35 bg-[#CBB487]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#CBB487]">
            SGT
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F2F0EB]">
          {t.auth.loginTitle}
        </h1>
        <p className="mt-1 text-sm text-[#A7AEBC]">{t.auth.loginSubtitle}</p>
      </div>

      {/* Direct Login Banner & 1-Click Fast Actions (Temporary Pre-Launch Testing) */}
      {DIRECT_LOGIN_ENABLED && (
        <section
          aria-label={isZh ? "免密直接登入快捷通道" : "1-Click Direct Login"}
          className="mb-5 rounded-xl border border-[#E7C98E]/40 bg-gradient-to-b from-[#1E1911] to-[#121316] p-4 text-xs shadow-lg"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E7C98E]/50 bg-[#E7C98E]/15 px-2.5 py-0.5 font-semibold text-[#F4DCAA]">
              <Sparkles className="h-3 w-3 text-[#E7C98E]" />
              <span>{isZh ? "免密直接登入模式已开启" : "Direct Login Active"}</span>
            </span>
            <span className="text-[10px] text-[#A7AEBC]">
              {isZh ? "正式上线前免输密码" : "Pre-Launch Testing"}
            </span>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-[#D6D8DE]">
            {isZh
              ? "无需手动输入账号密码，点击下方按钮即可直接登入并观看 10 珠竞速动画进入会员中心："
              : "No password needed. Click below to launch the 10-ball 3D race and enter directly:"}
          </p>

          <div className="mt-3 space-y-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleQuickLogin("admin")}
              className="r10-btn-gold-3d flex min-h-[42px] w-full items-center justify-between rounded-xl px-3.5 text-xs font-bold text-[#08090B] shadow-md transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 fill-current" />
                <span>
                  {isZh
                    ? "⚡ 一键直接登入管理员 (Elena Vance · BM100001)"
                    : "⚡ Direct Login as Admin (Elena Vance · BM100001)"}
                </span>
              </div>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => void handleQuickLogin("member")}
              className="flex min-h-[38px] w-full items-center justify-between rounded-xl border border-white/15 bg-white/[0.04] px-3.5 text-xs font-semibold text-[#EDEAE2] transition-colors hover:border-[#E7C98E] hover:text-[#E7C98E] active:scale-[0.98] disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-[#E7C98E]" />
                <span>
                  {isZh
                    ? "👤 一键直接登入普通会员 (Alex Chen · BM100002)"
                    : "👤 Direct Login as Member (Alex Chen · BM100002)"}
                </span>
              </div>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </section>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
        >
          {error}
        </div>
      )}

      {DIRECT_LOGIN_ENABLED && (
        <div className="mb-4 flex items-center gap-2 text-[11px] text-[#A7AEBC]">
          <div className="h-px flex-1 bg-white/[0.08]" />
          <span>{isZh ? "或手动测试账号输入" : "Or manual account credentials"}</span>
          <div className="h-px flex-1 bg-white/[0.08]" />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="login-identifier"
            className="mb-1.5 block text-xs font-medium text-[#F2F0EB]"
          >
            {t.auth.identifierLabel}
          </label>
          <input
            id="login-identifier"
            type="text"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="name@company.com / BM100002"
            className="min-h-[44px] w-full rounded-xl border border-white/[0.1] bg-[#08090B] px-3.5 py-2.5 text-sm text-[#F2F0EB] placeholder-[#A7AEBC]/45 outline-none transition focus:border-[#CBB487]"
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="mb-1.5 block text-xs font-medium text-[#F2F0EB]"
          >
            {t.auth.passwordLabel}
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="min-h-[44px] w-full rounded-xl border border-white/[0.1] bg-[#08090B] pl-3.5 pr-11 py-2.5 text-sm text-[#F2F0EB] placeholder-[#A7AEBC]/45 outline-none transition focus:border-[#CBB487]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword
                  ? isZh
                    ? "隐藏密码"
                    : "Hide password"
                  : isZh
                    ? "显示密码"
                    : "Show password"
              }
              className="absolute right-1 top-0.5 flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-[#A7AEBC] transition hover:text-[#F2F0EB]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#CBB487] px-4 py-2.5 text-sm font-semibold text-[#08090B] transition-all duration-100 hover:bg-[#D8C49B] active:scale-[0.98] disabled:opacity-50"
        >
          <span>
            {loading
              ? autoLoggingIn
                ? isZh
                  ? "免密直接登入中..."
                  : "Logging in..."
                : t.common.loading
              : t.auth.signInBtn}
          </span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-4 text-xs text-[#A7AEBC]">
        <span>
          {t.auth.noAccount}{" "}
          <Link href="/register" className="font-semibold text-[#CBB487] hover:underline">
            {t.auth.registerBtn}
          </Link>
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-[#A7AEBC]/80">
          <Lock className="h-3 w-3 text-[#CBB487]" />
          <span>TLS · SGT</span>
        </span>
      </div>
    </div>
  );
}
