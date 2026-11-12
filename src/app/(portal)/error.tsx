"use client";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-500/35 bg-[#141619] p-6 text-center">
      <h2 className="text-base font-semibold text-[#F2F0EB]">Something went wrong</h2>
      <p className="mt-1 text-xs text-[#A7AEBC]">
        {error.message || "Unable to load portal data."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 min-h-[44px] rounded-xl bg-[#CBB487] px-5 text-xs font-semibold text-[#08090B] transition-transform duration-100 active:scale-[0.98]"
      >
        Retry
      </button>
    </div>
  );
}
