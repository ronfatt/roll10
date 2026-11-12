import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ROLL10 · Global Membership & Settlement",
  description: "ROLL10 Dual-Track Membership & SGT Automated Settlement Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#08090B] text-[#F2F0EB] antialiased selection:bg-[#CBB487]/30 selection:text-[#F2F0EB]">
        {children}
      </body>
    </html>
  );
}
