"use client";

import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { Roll10Logo } from "@/components/Roll10Logo";

export function LoginForm({ t }: { t: Dictionary }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      const res = await signIn("credentials", {
        identifier: identifier.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError(t.auth.invalidCredentials);
        setLoading(false);
        inFlightRef.current = false;
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t.auth.signInFailed);
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#141619] p-6 shadow-2xl sm:p-8">
      <div className="mb-6">
        <div className="mb-5 flex items-center justify-between">
          <Roll10Logo className="h-6 w-auto" />
          <span className="font-mono-sgt rounded-full border border-[#CBB487]/35 bg-[#CBB487]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#CBB487]">
            SGT
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F2F0EB]">
          {t.auth.loginTitle}
        </h1>
        <p className="mt-1 text-sm text-[#A7AEBC]">{t.auth.loginSubtitle}</p>
      </div>

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
              aria-label={showPassword ? "Hide password" : "Show password"}
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
          <span>{loading ? t.common.loading : t.auth.signInBtn}</span>
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
