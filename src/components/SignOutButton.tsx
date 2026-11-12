"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-100"
    >
      <LogOut className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
