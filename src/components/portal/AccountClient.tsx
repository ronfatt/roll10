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
import { SubpageHeaderTitle } from "@/components/Roll10Logo";

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

  // Mask referral link as single-line: ****************ref=BM100001
  const maskedReferralDisplay = referralLink.includes("ref=")
    ? `****************${referralLink.slice(referralLink.indexOf("ref="))}`
    : referralLink;

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
    <div className="space-y-4 pb-4">
      {/* Subpage Header */}
      <SubpageHeaderTitle
        title={t.account.title}
        subtitle={locale === "zh-CN" ? "会员身份与账户设置" : "Member Identity & Preferences"}
      />

      {/* Member Profile Identity Card with Luxury Gold Rim */}
      <div className="r10-card-gold-rim relative overflow-hidden rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#F2CD7E]/40 bg-[#F2CD7E]/10 text-[#F2CD7E] shadow-[0_0_12px_rgba(242,205,126,0.25)]">
            <User className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-[#F4F8FC]">
              {member.displayName}
              {member.role === "ADMIN" && (
                <span className="ml-1.5 text-xs font-semibold text-[#51E7FA]">
                  ({locale === "zh-CN" ? "管理" : "Admin"})
                </span>
              )}
            </div>
            <div className="font-mono-sgt truncate text-xs text-[#AAB8C7]">
              {member.memberCode} · {member.email}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 divide-x divide-[#2B3D4D] overflow-hidden rounded-xl border border-[#2B3D4D] bg-[#0A101A] text-xs">
          <div className="p-3">
            <div className="text-[#AAB8C7]">{t.packages.currentTier}</div>
            <div className="mt-0.5 font-black italic text-[#F2CD7E] text-sm">
              {member.currentPackageCode ?? t.overview.pendingActivation}
            </div>
          </div>
          <div className="p-3">
            <div className="text-[#AAB8C7]">{t.common.status}</div>
            <div className="mt-0.5 font-bold text-[#51E7FA]">
              {formatMemberStatus(member.status, locale)}
              {member.pendingUpgradePackageCode ? ` (→ ${member.pendingUpgradePackageCode})` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Personal Referral Invite Card */}
      <div className="rounded-2xl border border-[#2B3D4D] bg-[#101B27] p-4 shadow-md">
        <div className="text-xs font-medium text-[#AAB8C7]">{t.account.referralTitle}</div>
        <div className="font-mono-sgt mt-2 truncate rounded-xl border border-[#2B3D4D] bg-[#0A101A] px-3.5 py-2.5 text-xs text-[#CAD7E6]">
          {maskedReferralDisplay}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#51E7FA] px-4 text-xs font-bold text-[#0A101A] transition hover:brightness-110 active:scale-[0.98] shadow-[0_0_12px_rgba(81,231,250,0.3)]"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? t.common.copied : t.common.copy}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#2B3D4D] bg-[#101B27] px-4 text-xs font-medium text-[#F4F8FC] transition hover:border-[#51E7FA]/60"
          >
            <Share2 className="h-4 w-4 text-[#51E7FA]" />
            <span>{t.common.share}</span>
          </button>
        </div>
      </div>

      {/* Quick Links: Upgrade Orders, BV & EOD Ledgers, Admin */}
      <div className="divide-y divide-[#2B3D4D] rounded-2xl border border-[#2B3D4D] bg-[#101B27] shadow-md overflow-hidden">
        <Link
          href="/packages"
          className="flex min-h-[52px] items-center justify-between px-4 py-3 text-sm font-medium text-[#F4F8FC] transition-colors hover:bg-white/[0.02]"
        >
          <span className="flex items-center gap-3">
            <Layers className="h-4 w-4 text-[#51E7FA]" />
            <span>{t.account.upgradeOrdersLink}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-[#AAB8C7]" />
        </Link>

        <Link
          href="/ledgers?tab=bv"
          className="flex min-h-[52px] items-center justify-between px-4 py-3 text-sm font-medium text-[#F4F8FC] transition-colors hover:bg-white/[0.02]"
        >
          <span className="flex items-center gap-3">
            <Award className="h-4 w-4 text-[#51E7FA]" />
            <span>{t.account.bvLedgersLink}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-[#AAB8C7]" />
        </Link>

        {member.role === "ADMIN" && (
          <Link
            href="/admin/orders"
            className="flex min-h-[52px] items-center justify-between px-4 py-3 text-sm font-medium text-[#51E7FA] transition-colors hover:bg-white/[0.02]"
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
      <div className="space-y-3 rounded-2xl border border-[#2B3D4D] bg-[#101B27] p-4 shadow-md">
        <div className="flex min-h-[44px] items-center justify-between">
          <span className="text-sm font-medium text-[#F4F8FC]">{t.account.languageTitle}</span>
          <LocaleToggle locale={locale} />
        </div>
        <div className="flex min-h-[40px] items-center justify-between border-t border-[#2B3D4D] pt-3 text-xs">
          <span className="flex items-center gap-2 text-[#AAB8C7]">
            <Clock className="h-3.5 w-3.5 text-[#51E7FA]" />
            <span>{t.account.timezoneLabel}</span>
          </span>
          <span className="font-mono-sgt font-medium text-[#F4F8FC]">
            Asia/Singapore (SGT)
          </span>
        </div>
        <div className="flex items-start gap-2.5 border-t border-[#2B3D4D] pt-3 text-xs text-[#AAB8C7]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#51E7FA]" />
          <div>
            <div className="font-medium text-[#F4F8FC]">{t.account.securityTitle}</div>
            <div className="mt-0.5 leading-relaxed">
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
        className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[#2B3D4D] bg-[#101B27] text-sm font-medium text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/5 active:scale-[0.98]"
      >
        <LogOut className="h-4 w-4" />
        <span>{t.nav.signOut}</span>
      </button>
    </div>
  );
}
