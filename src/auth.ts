import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

// Ensure NextAuth v5 trusts dynamic hosts (both localhost and vercel production) without host mismatch
if (typeof process !== "undefined" && process.env) {
  if (process.env.NEXTAUTH_URL) {
    delete process.env.NEXTAUTH_URL;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "binary-member-portal-dev-secret-change-in-prod-2026",
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Member Code", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = String(credentials?.identifier ?? "").trim();
        const password = String(credentials?.password ?? "");
        if (!identifier || !password) return null;

        const member = await prisma.member.findFirst({
          where: {
            OR: [
              { email: identifier.toLowerCase() },
              { memberCode: identifier.toUpperCase() },
            ],
          },
        });

        if (!member) return null;
        if (member.status === "CANCELLED" || member.status === "SUSPENDED") {
          return null;
        }

        const valid = await bcrypt.compare(password, member.passwordHash);
        if (!valid) return null;

        return {
          id: member.id,
          email: member.email,
          name: member.displayName,
          memberCode: member.memberCode,
          role: member.role,
          locale: member.locale,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.memberCode = (user as { memberCode?: string }).memberCode;
        token.role = (user as { role?: string }).role;
        token.locale = (user as { locale?: string }).locale;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? token.sub ?? "");
        (session.user as { memberCode?: string }).memberCode = String(token.memberCode ?? "");
        (session.user as { role?: string }).role = String(token.role ?? "MEMBER");
        (session.user as { locale?: string }).locale = String(token.locale ?? "en");
      }
      return session;
    },
  },
});
