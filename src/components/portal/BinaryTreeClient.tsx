"use client";

import { useEffect, useState } from "react";
import { ArrowUp, GitBranch, RotateCcw, Search } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { formatBv } from "@/lib/money";

interface TreeNodeDto {
  id: string;
  memberCode: string;
  displayName: string;
  status: string;
  packageCode: string | null;
  placementParentId: string | null;
  placementLeg: "LEFT" | "RIGHT" | null;
  leftBv: number;
  rightBv: number;
  leftCount: number;
  rightCount: number;
  left: TreeNodeDto | null;
  right: TreeNodeDto | null;
}

function NodeCard({
  node,
  onFocus,
  isRootFocus,
  t,
}: {
  node: TreeNodeDto;
  onFocus: (id: string) => void;
  isRootFocus?: boolean;
  t: Dictionary;
}) {
  return (
    <button
      type="button"
      onClick={() => onFocus(node.id)}
      className={`w-full rounded-2xl border p-3.5 text-left transition ${
        isRootFocus
          ? "border-[#D4AF37]/70 bg-gradient-to-b from-[#D4AF37]/15 to-[#11151D]"
          : "border-white/10 bg-[#11151D] hover:border-[#D4AF37]/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="tabular-nums text-xs font-bold text-[#E5C158]">
          {node.memberCode}
        </span>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-zinc-200">
          {node.packageCode ?? node.status}
        </span>
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-white">
        {node.displayName}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[11px]">
        <div className="rounded-lg bg-white/[0.04] px-2 py-1">
          <div className="text-zinc-400">L ({node.leftCount})</div>
          <div className="tabular-nums font-medium text-zinc-100">
            {formatBv(node.leftBv)}
          </div>
        </div>
        <div className="rounded-lg bg-white/[0.04] px-2 py-1">
          <div className="text-zinc-400">R ({node.rightCount})</div>
          <div className="tabular-nums font-medium text-zinc-100">
            {formatBv(node.rightBv)}
          </div>
        </div>
      </div>
      {node.placementLeg && (
        <div className="mt-1.5 text-[10px] text-zinc-500">
          {node.placementLeg === "LEFT" ? t.common.left : t.common.right}
        </div>
      )}
    </button>
  );
}

function EmptySlotCard({ legLabel, emptyLabel }: { legLabel: string; emptyLabel: string }) {
  return (
    <div className="flex h-full min-h-[104px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-3 text-center">
      <span className="text-[11px] font-medium text-zinc-500">{legLabel}</span>
      <span className="mt-0.5 text-xs text-zinc-600">{emptyLabel}</span>
    </div>
  );
}

export function BinaryTreeClient({
  t,
  initialFocusId,
  viewerId,
}: {
  t: Dictionary;
  initialFocusId: string;
  viewerId: string;
}) {
  const [tree, setTree] = useState<TreeNodeDto | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTree = async (params: { focusId?: string; q?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({ depth: "2" });
      if (params.focusId) sp.set("focusId", params.focusId);
      if (params.q) sp.set("q", params.q);
      const res = await fetch(`/api/tree?${sp.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to load tree");
        setLoading(false);
        return;
      }
      setTree(data.tree);
      setLoading(false);
    } catch {
      setError("Network error loading tree");
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTree({ focusId: initialFocusId });
  }, [initialFocusId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    void fetchTree({ q: query.trim() });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {t.tree.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">{t.tree.subtitle}</p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.tree.locatePlaceholder}
              className="rounded-xl border border-white/10 bg-[#11151D] py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#D4AF37]/60"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#D4AF37] px-3.5 py-2 text-xs font-semibold text-[#090B0F] hover:bg-[#E5C158]"
          >
            {t.tree.locateBtn}
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              void fetchTree({ focusId: viewerId });
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 hover:border-[#D4AF37]/40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t.tree.backToMe}</span>
          </button>
          {tree?.placementParentId && tree.id !== viewerId && (
            <button
              type="button"
              onClick={() => void fetchTree({ focusId: tree.placementParentId! })}
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 hover:border-[#D4AF37]/40"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              <span>{t.tree.parentNode}</span>
            </button>
          )}
        </form>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {loading && !tree ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#11151D] p-10 text-center text-sm text-zinc-400">
          {t.common.loading}
        </div>
      ) : tree ? (
        <div className="space-y-5 rounded-2xl border border-white/[0.08] bg-[#0D1017] p-4 sm:p-6">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <GitBranch className="h-4 w-4 text-[#D4AF37]" />
            <span>Click any node card to focus & expand deeper levels</span>
          </div>

          {/* Level 0: Focus Node */}
          <div className="mx-auto max-w-xs">
            <NodeCard
              node={tree}
              isRootFocus
              onFocus={(id) => void fetchTree({ focusId: id })}
              t={t}
            />
          </div>

          {/* Level 1: Left & Right */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Left Branch */}
            <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {t.common.left} ({t.tree.leftCount}: {tree.leftCount})
              </div>
              {tree.left ? (
                <NodeCard
                  node={tree.left}
                  onFocus={(id) => void fetchTree({ focusId: id })}
                  t={t}
                />
              ) : (
                <EmptySlotCard legLabel={t.common.left} emptyLabel={t.tree.emptySlot} />
              )}

              {/* Level 2 under Left */}
              {tree.left && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {tree.left.left ? (
                    <NodeCard
                      node={tree.left.left}
                      onFocus={(id) => void fetchTree({ focusId: id })}
                      t={t}
                    />
                  ) : (
                    <EmptySlotCard legLabel={t.common.left} emptyLabel={t.tree.emptySlot} />
                  )}
                  {tree.left.right ? (
                    <NodeCard
                      node={tree.left.right}
                      onFocus={(id) => void fetchTree({ focusId: id })}
                      t={t}
                    />
                  ) : (
                    <EmptySlotCard legLabel={t.common.right} emptyLabel={t.tree.emptySlot} />
                  )}
                </div>
              )}
            </div>

            {/* Right Branch */}
            <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {t.common.right} ({t.tree.rightCount}: {tree.rightCount})
              </div>
              {tree.right ? (
                <NodeCard
                  node={tree.right}
                  onFocus={(id) => void fetchTree({ focusId: id })}
                  t={t}
                />
              ) : (
                <EmptySlotCard legLabel={t.common.right} emptyLabel={t.tree.emptySlot} />
              )}

              {/* Level 2 under Right */}
              {tree.right && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {tree.right.left ? (
                    <NodeCard
                      node={tree.right.left}
                      onFocus={(id) => void fetchTree({ focusId: id })}
                      t={t}
                    />
                  ) : (
                    <EmptySlotCard legLabel={t.common.left} emptyLabel={t.tree.emptySlot} />
                  )}
                  {tree.right.right ? (
                    <NodeCard
                      node={tree.right.right}
                      onFocus={(id) => void fetchTree({ focusId: id })}
                      t={t}
                    />
                  ) : (
                    <EmptySlotCard legLabel={t.common.right} emptyLabel={t.tree.emptySlot} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
