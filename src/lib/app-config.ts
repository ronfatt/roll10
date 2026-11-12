/**
 * Platform Configuration & Feature Flags
 *
 * DIRECT_LOGIN_ENABLED:
 *   - true (default during development/testing):
 *       Allows 1-click direct login without typing member ID & password.
 *       Clicking "会员登录" on landing page or visiting /login?auto=1 directly
 *       triggers the 10-ball 3D race animation and enters the dashboard.
 *   - false (official launch mode):
 *       Enforces manual input of credentials (identifier + password).
 *       Can be toggled via NEXT_PUBLIC_DIRECT_LOGIN=false in .env.
 */
export const DIRECT_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_DIRECT_LOGIN !== "false";

export const DEFAULT_DIRECT_LOGIN_ACCOUNT = {
  admin: {
    identifier: "admin@binaryportal.io",
    password: "Password123!",
    displayName: "Elena Vance",
    memberCode: "BM100001",
    role: "ADMIN",
    tier: "P1000",
  },
  member: {
    identifier: "alex@binaryportal.io",
    password: "Password123!",
    displayName: "Alex Chen",
    memberCode: "BM100002",
    role: "MEMBER",
    tier: "P100",
  },
};
