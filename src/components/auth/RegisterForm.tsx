"use client";

import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, UserCheck } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { Roll10Logo } from "@/components/Roll10Logo";

export function RegisterForm({
  t,
  initialRef,
  sponsorDisplayName,
}: {
  t: Dictionary;
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
  const [submitPaymentNow, setSubmitPaymentNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);

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
          payImmediatelyDemo: false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Registration failed");
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
      setError("Network error while registering");
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
            placeholder="Full name"
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
              placeholder="Min 6 characters"
              className="min-h-[44px] w-full rounded-xl border border-white/[0.1] bg-[#08090B] pl-3.5 pr-11 py-2.5 text-sm text-[#F2F0EB] placeholder-[#A7AEBC]/45 outline-none focus:border-[#CBB487]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
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
              { code: "P100" as const, price: "100 U", bv: "100 BV", cap: "100 U/d" },
              { code: "P500" as const, price: "500 U", bv: "500 BV", cap: "500 U/d" },
              { code: "P1000" as const, price: "1,000 U", bv: "1,000 BV", cap: "1,000 U/d" },
            ].map((pkg) => (
              <button
                key={pkg.code}
                type="button"
                onClick={() => setPackageCode(pkg.code)}
                className={`min-h-[64px] rounded-xl border p-2.5 text-left transition ${
                  packageCode === pkg.code
                    ? "border-[#CBB487] bg-[#CBB487]/15 text-[#F2F0EB]"
                    : "border-white/[0.08] bg-[#08090B] text-[#A7AEBC] hover:border-[#A7AEBC]/50"
                }`}
              >
                <div className="tabular-nums text-xs font-semibold text-[#CBB487]">
                  {pkg.price}
                </div>
                <div className="tabular-nums text-[11px] text-[#F2F0EB]">{pkg.bv}</div>
                <div className="tabular-nums text-[10px] text-[#A7AEBC]">Cap {pkg.cap}</div>
              </button>
            ))}
          </div>
        </div>

        <label className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#08090B] px-3 py-2 text-xs text-[#D6D3CC]">
          <input
            type="checkbox"
            checked={submitPaymentNow}
            onChange={(e) => setSubmitPaymentNow(e.target.checked)}
            className="h-4 w-4 accent-[#CBB487]"
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
