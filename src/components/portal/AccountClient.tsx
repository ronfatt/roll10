"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import {
  Award,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Layers,
  LogOut,
  Share2,
  Shield,
  ShieldCheck,
  User,
} from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatMemberStatus } from "@/lib/i18n-labels";
import { LocaleToggle } from "@/components/LocaleToggle";

export function AccountClient({
  t,
  locale,
  referralLink,
  member,
}: {
  t: Dictionary;
  locale: Locale;
  referralLink: string;
  member: {
    memberCode: string;
    email: string;
    displayName: string;
    role: "MEMBER" | "ADMIN";
    status: string;
    currentPackageCode: string | null;
    pendingUpgradePackageCode: string | null;
  };
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: t.brand,
          text:
            locale === "zh-CN"
              ? `欢迎加入 ROLL10 (${member.memberCode})`
              : `Join ROLL10 (${member.memberCode})`,
          url: referralLink,
        });
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }
    await handleCopy();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F2F0EB]">
          {t.account.title}
        </h1>
      </div>

      {/* Member Profile Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#CBB487]/40 bg-[#CBB487]/10 text-[#CBB487]">
            <User className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-[#F2F0EB]">
              {member.displayName}
            </div>
            <div className="font-mono-sgt truncate text-xs text-[#A7AEBC]">
              {member.memberCode} · {member.email}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 divide-x divide-white/[0.1] overflow-hidden rounded-xl border border-white/[0.07] bg-[#08090B] text-xs">
          <div className="p-3">
            <div className="text-[#A7AEBC]">{t.packages.currentTier}</div>
            <div className="mt-0.5 font-semibold text-[#CBB487]">
              {member.currentPackageCode ?? t.overview.pendingActivation}
            </div>
          </div>
          <div className="p-3">
            <div className="text-[#A7AEBC]">{t.common.status}</div>
            <div className="mt-0.5 font-semibold text-[#F2F0EB]">
              {formatMemberStatus(member.status, locale)}
              {member.pendingUpgradePackageCode ? ` (→ ${member.pendingUpgradePackageCode})` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Personal Referral Invite Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-4">
        <div className="text-xs font-medium text-[#A7AEBC]">{t.account.referralTitle}</div>
        <div className="font-mono-sgt mt-2 break-all rounded-xl border border-white/[0.07] bg-[#08090B] px-3 py-2.5 text-xs text-[#CBB487]">
          {referralLink}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#CBB487] px-4 text-xs font-semibold text-[#08090B] transition active:scale-[0.98]"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? t.common.copied : t.common.copy}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-[#08090B] px-4 text-xs font-medium text-[#F2F0EB] transition hover:border-[#CBB487]/60"
          >
            <Share2 className="h-4 w-4 text-[#CBB487]" />
            <span>{t.common.share}</span>
          </button>
        </div>
      </div>

      {/* Quick Links: Upgrade Orders, BV & EOD Ledgers, Admin */}
      <div className="divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08] bg-[#141619]">
        <Link
          href="/packages"
          className="flex min-h-[52px] items-center justify-between px-4 py-3 text-sm font-medium text-[#F2F0EB] transition-colors hover:bg-white/[0.02]"
        >
          <span className="flex items-center gap-3">
            <Layers className="h-4 w-4 text-[#CBB487]" />
            <span>{t.account.upgradeOrdersLink}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-[#A7AEBC]" />
        </Link>

        <Link
          href="/ledgers?tab=bv"
          className="flex min-h-[52px] items-center justify-between px-4 py-3 text-sm font-medium text-[#F2F0EB] transition-colors hover:bg-white/[0.02]"
        >
          <span className="flex items-center gap-3">
            <Award className="h-4 w-4 text-[#CBB487]" />
            <span>{t.account.bvLedgersLink}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-[#A7AEBC]" />
        </Link>

        {member.role === "ADMIN" && (
          <Link
            href="/admin/orders"
            className="flex min-h-[52px] items-center justify-between px-4 py-3 text-sm font-medium text-[#CBB487] transition-colors hover:bg-white/[0.02]"
          >
            <span className="flex items-center gap-3">
              <Shield className="h-4 w-4" />
              <span>{t.nav.admin}</span>
            </span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Preferences & Security */}
      <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#141619] p-4">
        <div className="flex min-h-[44px] items-center justify-between">
          <span className="text-sm font-medium text-[#F2F0EB]">{t.account.languageTitle}</span>
          <LocaleToggle locale={locale} />
        </div>
        <div className="flex min-h-[40px] items-center justify-between border-t border-white/[0.08] pt-3 text-xs">
          <span className="flex items-center gap-2 text-[#A7AEBC]">
            <Clock className="h-3.5 w-3.5 text-[#CBB487]" />
            <span>{t.account.timezoneLabel}</span>
          </span>
          <span className="font-mono-sgt font-medium text-[#F2F0EB]">
            Asia/Singapore (SGT)
          </span>
        </div>
        <div className="flex items-start gap-2.5 border-t border-white/[0.08] pt-3 text-xs text-[#A7AEBC]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#CBB487]" />
          <div>
            <div className="font-medium text-[#F2F0EB]">{t.account.securityTitle}</div>
            <div className="mt-0.5">
              {locale === "zh-CN"
                ? "已认证加密会话 · 服务端严格校验权限并按新加坡时间（SGT）执行不可篡改账本结算。"
                : "Authenticated session · Server-enforced permissions & immutable Asia/Singapore (SGT) ledger settlement."}
            </div>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-[#141619] text-sm font-medium text-rose-300 transition hover:border-rose-500/40"
      >
        <LogOut className="h-4 w-4" />
        <span>{t.nav.signOut}</span>
      </button>
    </div>
  );
}
