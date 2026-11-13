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
      <div className="r10-card-dark relative overflow-hidden p-4 sm:p-5 border border-[#29363D] bg-gradient-to-b from-[#172126] to-[#10171B]">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E9C66B]/40 bg-[#E9C66B]/10 text-[#E9C66B] shadow-[0_0_12px_rgba(233,198,107,0.25)]">
            <User className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-[#F4F6F7]">
              {member.displayName}
              {member.role === "ADMIN" && (
                <span className="ml-1.5 text-xs font-semibold text-[#00D9DF]">
                  ({locale === "zh-CN" ? "管理" : "Admin"})
                </span>
              )}
            </div>
            <div className="font-mono-sgt truncate text-xs text-[#829098]">
              {member.memberCode} · {member.email}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 divide-x divide-[#29363D] overflow-hidden rounded-xl border border-[#29363D] bg-[#070B0D] text-xs">
          <div className="p-3">
            <div className="text-[#829098]">{t.packages.currentTier}</div>
            <div className="mt-0.5 font-mono-sgt font-bold text-[#E9C66B] text-sm">
              {member.currentPackageCode ?? t.overview.pendingActivation}
            </div>
          </div>
          <div className="p-3">
            <div className="text-[#829098]">{t.common.status}</div>
            <div className="mt-0.5 font-bold text-[#00D9DF]">
              {formatMemberStatus(member.status, locale)}
              {member.pendingUpgradePackageCode ? ` (→ ${member.pendingUpgradePackageCode})` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Personal Referral Invite Card */}
      <div className="r10-card-dark p-4 shadow-md space-y-3">
        <div className="text-xs font-medium text-[#B0BBC2]">{t.account.referralTitle}</div>
        <div className="font-mono-sgt truncate rounded-xl border border-[#29363D] bg-[#070B0D] px-3.5 py-2.5 text-xs text-[#F4F6F7]">
          {maskedReferralDisplay}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="r10-btn-gold flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold text-[#070B0D] transition active:scale-[0.98]"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? t.common.copied : t.common.copy}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="r10-btn-dark flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-medium text-[#F4F6F7] transition hover:border-[#00D9DF]/60"
          >
            <Share2 className="h-4 w-4 text-[#00D9DF]" />
            <span>{t.common.share}</span>
          </button>
        </div>
      </div>

      {/* Quick Links: Upgrade Orders, BV & EOD Ledgers, Admin */}
      <div className="divide-y divide-[#29363D] rounded-2xl border border-[#29363D] bg-[#10171B] shadow-md overflow-hidden">
        <Link
          href="/packages"
          className="flex min-h-[52px] items-center justify-between px-4 py-3 text-sm font-medium text-[#F4F6F7] transition-colors hover:bg-white/[0.02]"
        >
          <span className="flex items-center gap-3">
            <Layers className="h-4 w-4 text-[#00D9DF]" />
            <span>{t.account.upgradeOrdersLink}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-[#829098]" />
        </Link>

        <Link
          href="/ledgers?tab=bv"
          className="flex min-h-[52px] items-center justify-between px-4 py-3 text-sm font-medium text-[#F4F6F7] transition-colors hover:bg-white/[0.02]"
        >
          <span className="flex items-center gap-3">
            <Award className="h-4 w-4 text-[#00D9DF]" />
            <span>{t.account.bvLedgersLink}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-[#829098]" />
        </Link>

        {member.role === "ADMIN" && (
          <Link
            href="/admin/orders"
            className="flex min-h-[52px] items-center justify-between px-4 py-3 text-sm font-medium text-[#00D9DF] transition-colors hover:bg-white/[0.02]"
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
      <div className="space-y-3 rounded-2xl border border-[#29363D] bg-[#10171B] p-4 shadow-md">
        <div className="flex min-h-[44px] items-center justify-between">
          <span className="text-sm font-medium text-[#F4F6F7]">{t.account.languageTitle}</span>
          <LocaleToggle locale={locale} />
        </div>
        <div className="flex min-h-[40px] items-center justify-between border-t border-[#29363D] pt-3 text-xs">
          <span className="flex items-center gap-2 text-[#829098]">
            <Clock className="h-3.5 w-3.5 text-[#00D9DF]" />
            <span>{t.account.timezoneLabel}</span>
          </span>
          <span className="font-mono-sgt font-medium text-[#F4F6F7]">
            Asia/Singapore (SGT)
          </span>
        </div>
        <div className="flex items-start gap-2.5 border-t border-[#29363D] pt-3 text-xs text-[#829098]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#00D9DF]" />
          <div>
            <div className="font-medium text-[#F4F6F7]">{t.account.securityTitle}</div>
            <div className="mt-0.5 leading-relaxed text-[#B0BBC2]">
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
        className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[#29363D] bg-[#10171B] text-sm font-medium text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/5 active:scale-[0.98]"
      >
        <LogOut className="h-4 w-4" />
        <span>{t.nav.signOut}</span>
      </button>
    </div>
  );
}
