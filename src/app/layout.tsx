import type { Metadata } from "next";
import { getServerLocale } from "@/lib/i18n-server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  if (locale === "zh-CN") {
    return {
      title: "ROLL10 · 国际会员平台与自动化日结系统",
      description: "ROLL10 双轨会员奖金制度与新加坡时间（SGT）自动化清算平台",
    };
  }
  return {
    title: "ROLL10 · Global Membership & Settlement",
    description: "ROLL10 Dual-Track Membership & SGT Automated Settlement Platform",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();
  return (
    <html lang={locale} className="dark">
      <body className="min-h-screen bg-[#070709] text-[#F2F0EB] antialiased">
        {children}
      </body>
    </html>
  );
}
