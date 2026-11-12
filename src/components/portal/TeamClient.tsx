"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Eye,
  GitBranch,
  Info,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Share2,
  Users,
  X,
} from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { formatBv } from "@/lib/money";
import type {
  PlacementBreadcrumbItem,
  PlacementNodeDto,
  PlacementSearchHit,
  ReferralNodeDto,
  ReferralSearchHit,
} from "@/lib/tree-queries";
import { BottomDrawer } from "@/components/MotionPrimitives";

interface ReferralPageState {
  children: ReferralNodeDto[];
  total: number;
  hasMore: boolean;
}

type DetailModalState =
  | { source: "referral"; node: ReferralNodeDto }
  | { source: "placement"; node: PlacementNodeDto }
  | null;

function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        active
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-amber-500/15 text-amber-300"
      }`}
    >
      {status}
    </span>
  );
}

/**
 * Desktop left-to-right horizontal branching mindmap (referring to attached branch style).
 */
function DesktopReferralBranch({
  node,
  rootId,
  depth,
  expandedIds,
  childrenMap,
  loadingMap,
  highlightedId,
  t,
  onToggleExpand,
  onLoadMore,
  onOpenDetail,
}: {
  node: ReferralNodeDto;
  rootId: string;
  depth: number;
  expandedIds: Set<string>;
  childrenMap: Record<string, ReferralPageState>;
  loadingMap: Record<string, boolean>;
  highlightedId: string | null;
  t: Dictionary;
  onToggleExpand: (node: ReferralNodeDto) => void;
  onLoadMore: (nodeId: string) => void;
  onOpenDetail: (node: ReferralNodeDto) => void;
}) {
  const isRoot = node.id === rootId;
  const isExpanded = expandedIds.has(node.id);
  const page = childrenMap[node.id];
  const isLoading = Boolean(loadingMap[node.id]);
  const isHighlighted = highlightedId === node.id;
  const hasChildren = node.directCount > 0;

  const branchItemsCount =
    (page?.children.length ?? 0) + (page?.hasMore ? 1 : 0);

  return (
    <div
      data-node-id={`ref-desktop-${node.id}`}
      className="flex items-center"
    >
      {/* Node Card + Right Toggle Stub */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={() => onOpenDetail(node)}
          className={`group relative w-52 rounded-xl border bg-[#141619] px-3.5 py-2.5 text-left transition-all duration-150 hover:border-[#CBB487]/70 ${
            isRoot || isHighlighted
              ? "border-[#CBB487]"
              : "border-white/[0.1]"
          } ${isHighlighted ? "r10-node-highlight" : ""}`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-mono-sgt text-[11px] font-bold text-[#CBB487]">
              {node.memberCode}
            </span>
            <span className="rounded border border-white/[0.08] bg-[#08090B] px-1.5 py-0.5 text-[10px] font-medium text-[#F2F0EB]">
              {node.packageCode ?? "—"}
            </span>
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-[#F2F0EB]">
            {node.displayName}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <StatusBadge status={node.status} />
            <span className="tabular-nums text-[10px] text-[#A7AEBC]">
              {node.directCount} {t.tree.directsUnit}
            </span>
          </div>
        </button>

        {/* Horizontal connector stub + circular (+/-) expand control */}
        {hasChildren && (
          <div className="flex items-center shrink-0">
            <span
              aria-hidden="true"
              className="h-px w-4 bg-[#CBB487]/45"
            />
            <button
              type="button"
              onClick={() => onToggleExpand(node)}
              aria-label={isExpanded ? t.tree.collapse : t.tree.expandMore}
              aria-expanded={isExpanded}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] transition-colors ${
                isExpanded
                  ? "border-[#CBB487]/65 bg-[#141619] text-[#CBB487] hover:bg-[#CBB487] hover:text-[#08090B]"
                  : "border-white/25 bg-[#141619] text-[#F2F0EB] hover:border-[#CBB487] hover:text-[#CBB487]"
              }`}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isExpanded ? (
                <Minus className="h-3 w-3" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </button>
            {isExpanded && page && branchItemsCount > 0 && (
              <span
                aria-hidden="true"
                className="h-px w-4 bg-[#CBB487]/45"
              />
            )}
          </div>
        )}
      </div>

      {/* Expanded Children Column with Seamless Vertical Spine + Branch Connectors */}
      {isExpanded && page && branchItemsCount > 0 && (
        <div className="r10-branch-enter flex flex-col">
          {page.children.map((child, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === branchItemsCount - 1;
            return (
              <div key={child.id} className="relative flex items-center py-1.5">
                {/* Spine & horizontal branch connector */}
                <div
                  aria-hidden="true"
                  className="relative w-6 shrink-0 self-stretch"
                >
                  {!isFirst && (
                    <span className="absolute left-0 top-0 bottom-1/2 w-px bg-[#CBB487]/45" />
                  )}
                  {!isLast && (
                    <span className="absolute left-0 top-1/2 bottom-0 w-px bg-[#CBB487]/45" />
                  )}
                  <span className="absolute left-0 right-0 top-1/2 h-px bg-[#CBB487]/45" />
                </div>

                <DesktopReferralBranch
                  node={child}
                  rootId={rootId}
                  depth={depth + 1}
                  expandedIds={expandedIds}
                  childrenMap={childrenMap}
                  loadingMap={loadingMap}
                  highlightedId={highlightedId}
                  t={t}
                  onToggleExpand={onToggleExpand}
                  onLoadMore={onLoadMore}
                  onOpenDetail={onOpenDetail}
                />
              </div>
            );
          })}

          {page.hasMore && (
            <div className="relative flex items-center py-1.5">
              <div
                aria-hidden="true"
                className="relative w-6 shrink-0 self-stretch"
              >
                <span className="absolute left-0 top-0 bottom-1/2 w-px bg-[#CBB487]/45" />
                <span className="absolute left-0 right-0 top-1/2 h-px bg-[#CBB487]/45" />
              </div>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => onLoadMore(node.id)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#CBB487]/45 bg-[#141619] px-3.5 text-xs font-medium text-[#CBB487] transition hover:border-[#CBB487] hover:bg-[#CBB487]/10 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>
                  {t.tree.loadMore} ({page.total - page.children.length})
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Mobile vertical collapsible branch tree with hairline connectors.
 * Indentation is bounded cleanly so cards stay readable from 360px upward.
 */
function MobileReferralBranch({
  node,
  rootId,
  depth,
  expandedIds,
  childrenMap,
  loadingMap,
  highlightedId,
  t,
  onToggleExpand,
  onLoadMore,
  onOpenDetail,
}: {
  node: ReferralNodeDto;
  rootId: string;
  depth: number;
  expandedIds: Set<string>;
  childrenMap: Record<string, ReferralPageState>;
  loadingMap: Record<string, boolean>;
  highlightedId: string | null;
  t: Dictionary;
  onToggleExpand: (node: ReferralNodeDto) => void;
  onLoadMore: (nodeId: string) => void;
  onOpenDetail: (node: ReferralNodeDto) => void;
}) {
  const isRoot = node.id === rootId;
  const isExpanded = expandedIds.has(node.id);
  const page = childrenMap[node.id];
  const isLoading = Boolean(loadingMap[node.id]);
  const isHighlighted = highlightedId === node.id;
  const hasChildren = node.directCount > 0;

  // Keep horizontal indentation compact from 360px onward so cards are never squeezed.
  const childWrapperIndent =
    depth === 0 ? "ml-3 pl-3" : depth === 1 ? "ml-2.5 pl-2.5" : "ml-1.5 pl-2";

  return (
    <div data-node-id={`ref-mobile-${node.id}`} className="relative">
      <div
        className={`flex items-stretch gap-2 rounded-2xl border bg-[#141619] p-3 transition-all duration-150 ${
          isRoot || isHighlighted
            ? "border-[#CBB487]"
            : "border-white/[0.08]"
        } ${isHighlighted ? "r10-node-highlight" : ""}`}
      >
        <button
          type="button"
          onClick={() => onOpenDetail(node)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {depth > 2 && (
              <span className="font-mono-sgt rounded bg-[#CBB487]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#CBB487]">
                L{depth}
              </span>
            )}
            <span className="font-mono-sgt text-xs font-bold text-[#CBB487]">
              {node.memberCode}
            </span>
            <span className="rounded border border-white/[0.08] bg-[#08090B] px-2 py-0.5 text-[10px] font-medium text-[#F2F0EB]">
              {node.packageCode ?? "—"}
            </span>
            <StatusBadge status={node.status} />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-[#F2F0EB]">
              {node.displayName}
            </span>
            <span className="shrink-0 tabular-nums text-[11px] text-[#A7AEBC]">
              {node.directCount} {t.tree.directsUnit}
            </span>
          </div>
        </button>

        {hasChildren && (
          <button
            type="button"
            onClick={() => onToggleExpand(node)}
            aria-label={isExpanded ? t.tree.collapse : t.tree.expandMore}
            aria-expanded={isExpanded}
            className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border transition-colors ${
              isExpanded
                ? "border-[#CBB487]/55 bg-[#CBB487]/12 text-[#CBB487]"
                : "border-white/[0.1] bg-[#08090B] text-[#F2F0EB] hover:border-[#CBB487]/60"
            }`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isExpanded ? (
              <Minus className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Expanded Vertical Children with Branch Spine */}
      {isExpanded && page && (
        <div
          className={`r10-branch-enter mt-2 space-y-2 border-l border-[#CBB487]/35 ${childWrapperIndent}`}
        >
          {page.children.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.1] px-3 py-2 text-[11px] text-[#A7AEBC]">
              {t.tree.noChildren}
            </div>
          ) : (
            page.children.map((child) => (
              <div key={child.id} className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-3 top-6 h-px w-3 bg-[#CBB487]/40"
                />
                <MobileReferralBranch
                  node={child}
                  rootId={rootId}
                  depth={depth + 1}
                  expandedIds={expandedIds}
                  childrenMap={childrenMap}
                  loadingMap={loadingMap}
                  highlightedId={highlightedId}
                  t={t}
                  onToggleExpand={onToggleExpand}
                  onLoadMore={onLoadMore}
                  onOpenDetail={onOpenDetail}
                />
              </div>
            ))
          )}

          {page.hasMore && (
            <div className="relative pt-0.5">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -left-3 top-5 h-px w-3 bg-[#CBB487]/40"
              />
              <button
                type="button"
                disabled={isLoading}
                onClick={() => onLoadMore(node.id)}
                className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#CBB487]/45 bg-[#141619] px-3 text-xs font-semibold text-[#CBB487] transition hover:border-[#CBB487] disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>
                  {t.tree.loadMore} ({page.total - page.children.length})
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TeamClient({
  t,
  initialFocusId,
  viewerId,
  viewerMemberCode,
  referralLink,
  initialTab,
}: {
  t: Dictionary;
  initialFocusId: string;
  viewerId: string;
  viewerMemberCode: string;
  referralLink: string;
  initialTab: "referral" | "placement";
}) {
  const [activeTab, setActiveTab] = useState<"referral" | "placement">(initialTab);
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);

  // Per-tab scroll position preservation
  const scrollPositionsRef = useRef<{ referral: number; placement: number }>({
    referral: 0,
    placement: 0,
  });
  const desktopScrollRef = useRef<HTMLDivElement>(null);

  // Toolbar search state
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [refSearchResults, setRefSearchResults] = useState<ReferralSearchHit[] | null>(null);
  const [placeSearchResults, setPlaceSearchResults] = useState<PlacementSearchHit[] | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Detail BottomDrawer state
  const [detailModal, setDetailModal] = useState<DetailModalState>(null);

  // -------- Referral Tree State --------
  const [refRoot, setRefRoot] = useState<ReferralNodeDto | null>(null);
  const [refExpandedIds, setRefExpandedIds] = useState<Set<string>>(new Set());
  const [refChildrenMap, setRefChildrenMap] = useState<Record<string, ReferralPageState>>({});
  const [refLoadingMap, setRefLoadingMap] = useState<Record<string, boolean>>({});
  const [refInitialLoading, setRefInitialLoading] = useState(true);
  const [refError, setRefError] = useState<string | null>(null);

  // -------- Placement Tree State --------
  const [placeRootOverview, setPlaceRootOverview] = useState<{
    leftBv: number;
    rightBv: number;
    leftCount: number;
    rightCount: number;
  } | null>(null);
  const [placeFocus, setPlaceFocus] = useState<PlacementNodeDto | null>(null);
  const [placeLeft, setPlaceLeft] = useState<PlacementNodeDto | null>(null);
  const [placeRight, setPlaceRight] = useState<PlacementNodeDto | null>(null);
  const [placeBreadcrumbs, setPlaceBreadcrumbs] = useState<PlacementBreadcrumbItem[]>([]);
  const [placeLoading, setPlaceLoading] = useState(true);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const triggerHighlight = useCallback((nodeId: string) => {
    setHighlightedId(nodeId);
    requestAnimationFrame(() => {
      const mobileEl = document.querySelector(`[data-node-id="ref-mobile-${nodeId}"]`);
      const desktopEl = document.querySelector(`[data-node-id="ref-desktop-${nodeId}"]`);
      const placeEl = document.querySelector(`[data-node-id="place-${nodeId}"]`);
      const targetEl =
        (desktopEl && (desktopEl as HTMLElement).offsetParent !== null ? desktopEl : null) ??
        (mobileEl && (mobileEl as HTMLElement).offsetParent !== null ? mobileEl : null) ??
        placeEl;
      if (targetEl && "scrollIntoView" in targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    });
  }, []);

  // Load Referral Tree root + 1st layer
  const loadReferralRoot = useCallback(async () => {
    setRefInitialLoading(true);
    setRefError(null);
    try {
      const res = await fetch(
        `/api/tree/referral?rootId=${encodeURIComponent(initialFocusId)}&parentId=${encodeURIComponent(initialFocusId)}&offset=0&limit=5`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok || !data.ok || !data.parent) {
        setRefError(data.error || t.common.loadError);
        setRefInitialLoading(false);
        return;
      }
      setRefRoot(data.parent);
      setRefChildrenMap((prev) => ({
        ...prev,
        [data.parent.id]: {
          children: data.children,
          total: data.total,
          hasMore: data.hasMore,
        },
      }));
      setRefExpandedIds(new Set([data.parent.id]));
      setRefInitialLoading(false);
    } catch {
      setRefError(t.common.loadError);
      setRefInitialLoading(false);
    }
  }, [initialFocusId, t.common.loadError]);

  const loadReferralChildren = useCallback(
    async (parentId: string, offset: number, append: boolean) => {
      setRefLoadingMap((m) => ({ ...m, [parentId]: true }));
      setRefError(null);
      try {
        const res = await fetch(
          `/api/tree/referral?rootId=${encodeURIComponent(initialFocusId)}&parentId=${encodeURIComponent(parentId)}&offset=${offset}&limit=5`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setRefError(data.error || t.common.loadError);
          setRefLoadingMap((m) => ({ ...m, [parentId]: false }));
          return;
        }
        setRefChildrenMap((prev) => {
          const existing = prev[parentId]?.children ?? [];
          const nextChildren = append
            ? [
                ...existing,
                ...(data.children as ReferralNodeDto[]).filter(
                  (c) => !existing.some((e) => e.id === c.id)
                ),
              ]
            : (data.children as ReferralNodeDto[]);
          return {
            ...prev,
            [parentId]: {
              children: nextChildren,
              total: data.total,
              hasMore: data.hasMore,
            },
          };
        });
        setRefExpandedIds((prev) => {
          const next = new Set(prev);
          next.add(parentId);
          return next;
        });
      } catch {
        setRefError(t.common.loadError);
      } finally {
        setRefLoadingMap((m) => ({ ...m, [parentId]: false }));
      }
    },
    [initialFocusId, t.common.loadError]
  );

  const handleToggleReferralExpand = useCallback(
    (node: ReferralNodeDto) => {
      if (refExpandedIds.has(node.id)) {
        setRefExpandedIds((prev) => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
        return;
      }
      if (refChildrenMap[node.id]) {
        setRefExpandedIds((prev) => {
          const next = new Set(prev);
          next.add(node.id);
          return next;
        });
        return;
      }
      void loadReferralChildren(node.id, 0, false);
    },
    [loadReferralChildren, refChildrenMap, refExpandedIds]
  );

  const handleLoadMoreReferral = useCallback(
    (parentId: string) => {
      const currentCount = refChildrenMap[parentId]?.children.length ?? 0;
      void loadReferralChildren(parentId, currentCount, true);
    },
    [loadReferralChildren, refChildrenMap]
  );

  const locateInReferralTree = useCallback(
    async (targetId: string) => {
      setRefError(null);
      setRefInitialLoading(refRoot === null);
      try {
        const res = await fetch(
          `/api/tree/referral?rootId=${encodeURIComponent(initialFocusId)}&locateId=${encodeURIComponent(targetId)}&limit=5`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setRefError(data.error || t.common.loadError);
          setRefInitialLoading(false);
          return;
        }
        if (data.rootNode) setRefRoot(data.rootNode);
        const slices = (data.slices ?? {}) as Record<string, ReferralPageState>;
        setRefChildrenMap((prev) => ({ ...prev, ...slices }));
        const pathIds = (data.pathIds ?? []) as string[];
        setRefExpandedIds((prev) => {
          const next = new Set(prev);
          for (let i = 0; i < Math.max(0, pathIds.length - 1); i++) {
            next.add(pathIds[i]);
          }
          if (data.rootNode?.id) next.add(data.rootNode.id);
          return next;
        });
        setRefInitialLoading(false);
        setRefSearchResults(null);
        triggerHighlight(targetId);
      } catch {
        setRefError(t.common.loadError);
        setRefInitialLoading(false);
      }
    },
    [initialFocusId, refRoot, t.common.loadError, triggerHighlight]
  );

  // Load Placement Tree focus node + immediate L/R
  const loadPlacementFocus = useCallback(
    async (focusId: string, highlightTarget: boolean = false) => {
      setPlaceLoading(true);
      setPlaceError(null);
      try {
        const res = await fetch(
          `/api/tree/placement?rootId=${encodeURIComponent(initialFocusId)}&focusId=${encodeURIComponent(focusId)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok || !data.ok || !data.focus) {
          setPlaceError(data.error || t.common.loadError);
          setPlaceLoading(false);
          return;
        }
        if (data.rootOverview) setPlaceRootOverview(data.rootOverview);
        setPlaceFocus(data.focus);
        setPlaceLeft(data.left ?? null);
        setPlaceRight(data.right ?? null);
        setPlaceBreadcrumbs(data.breadcrumbs ?? []);
        setPlaceLoading(false);
        if (highlightTarget) {
          triggerHighlight(focusId);
        }
      } catch {
        setPlaceError(t.common.loadError);
        setPlaceLoading(false);
      }
    },
    [initialFocusId, t.common.loadError, triggerHighlight]
  );

  useEffect(() => {
    void loadReferralRoot();
    void loadPlacementFocus(initialFocusId, false);
  }, [initialFocusId, loadPlacementFocus, loadReferralRoot]);

  // Switch between Referral Tree & Placement Tree while saving/restoring scroll & expanded states
  const handleTabSwitch = (nextTab: "referral" | "placement") => {
    if (nextTab === activeTab) return;
    scrollPositionsRef.current[activeTab] = window.scrollY;
    setSearchError(null);
    setRefSearchResults(null);
    setPlaceSearchResults(null);
    setActiveTab(nextTab);
    requestAnimationFrame(() => {
      window.scrollTo({
        top: scrollPositionsRef.current[nextTab],
        behavior: "instant" as ScrollBehavior,
      });
    });
  };

  // Search submission per active tab
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setRefSearchResults(null);
    setPlaceSearchResults(null);

    try {
      const endpoint =
        activeTab === "referral"
          ? `/api/tree/referral?rootId=${encodeURIComponent(initialFocusId)}&q=${encodeURIComponent(q)}`
          : `/api/tree/placement?rootId=${encodeURIComponent(initialFocusId)}&q=${encodeURIComponent(q)}`;
      const res = await fetch(endpoint, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSearchError(data.error || t.common.loadError);
      } else if (activeTab === "referral") {
        setRefSearchResults(data.results as ReferralSearchHit[]);
      } else {
        setPlaceSearchResults(data.results as PlacementSearchHit[]);
      }
    } catch {
      setSearchError(t.common.loadError);
    } finally {
      setSearching(false);
    }
  };

  const handleBackToMe = () => {
    setSearchInput("");
    setSearchError(null);
    setRefSearchResults(null);
    setPlaceSearchResults(null);
    if (activeTab === "referral") {
      if (refRoot) {
        setRefExpandedIds(new Set([refRoot.id]));
        triggerHighlight(refRoot.id);
      } else {
        void loadReferralRoot();
      }
    } else {
      void loadPlacementFocus(initialFocusId, true);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedMsg(t.common.copied);
      setTimeout(() => setCopiedMsg(null), 2000);
    } catch {
      setCopiedMsg(t.common.copied);
    }
  };

  const handleShareLink = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: t.brand,
          text: `Join ROLL10 via ${viewerMemberCode}`,
          url: referralLink,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await handleCopyLink();
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Header + Compact Referral Link Action */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F2F0EB]">
            {t.tree.title}
          </h1>
          <p className="mt-0.5 text-xs text-[#A7AEBC]">{t.tree.subtitle}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#CBB487]/35 bg-[#141619] px-3 text-xs font-medium text-[#CBB487] transition hover:border-[#CBB487]"
          >
            {copiedMsg ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedMsg ?? t.common.copy}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleShareLink()}
            aria-label={t.common.share}
            className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl border border-white/[0.1] bg-[#141619] text-[#F2F0EB] transition hover:border-[#CBB487]/60"
          >
            <Share2 className="h-3.5 w-3.5 text-[#CBB487]" />
          </button>
        </div>
      </div>

      {/* Top Segmented Tabs: Referral Tree (Default) / Placement Tree */}
      <div
        role="tablist"
        aria-label={t.tree.title}
        className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/[0.08] bg-[#141619] p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "referral"}
          onClick={() => handleTabSwitch("referral")}
          className={`min-h-[44px] rounded-xl text-xs font-semibold transition-all duration-150 ${
            activeTab === "referral"
              ? "bg-[#CBB487] text-[#08090B]"
              : "text-[#A7AEBC] hover:text-[#F2F0EB]"
          }`}
        >
          {t.tree.tabReferral}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "placement"}
          onClick={() => handleTabSwitch("placement")}
          className={`min-h-[44px] rounded-xl text-xs font-semibold transition-all duration-150 ${
            activeTab === "placement"
              ? "bg-[#CBB487] text-[#08090B]"
              : "text-[#A7AEBC] hover:text-[#F2F0EB]"
          }`}
        >
          {t.tree.tabPlacement}
        </button>
      </div>

      {/* Shared Toolbar: Search + Back to Me */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearch} className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#A7AEBC]" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t.tree.locatePlaceholder}
                className="min-h-[44px] w-full rounded-xl border border-white/[0.1] bg-[#141619] pl-9 pr-3 text-xs text-[#F2F0EB] placeholder-[#A7AEBC]/60 outline-none transition focus:border-[#CBB487]"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="min-h-[44px] shrink-0 rounded-xl bg-[#CBB487] px-3.5 text-xs font-semibold text-[#08090B] transition active:scale-[0.98] disabled:opacity-60"
            >
              {searching ? "..." : t.tree.locateBtn}
            </button>
          </form>

          <button
            type="button"
            onClick={handleBackToMe}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.1] bg-[#141619] px-3 text-xs font-medium text-[#F2F0EB] transition hover:border-[#CBB487]/60"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#CBB487]" />
            <span>{t.tree.backToMe}</span>
          </button>
        </div>

        {/* Search Error */}
        {searchError && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-xl border border-rose-500/35 bg-[#141619] px-3.5 py-2.5 text-xs text-rose-300"
          >
            <span>{searchError}</span>
            <button
              type="button"
              onClick={() => setSearchError(null)}
              className="text-[#A7AEBC] hover:text-[#F2F0EB]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Referral Search Dropdown Results */}
        {activeTab === "referral" && refSearchResults !== null && (
          <div className="rounded-2xl border border-[#CBB487]/35 bg-[#141619] p-3 text-xs">
            <div className="mb-2 flex items-center justify-between text-[11px] text-[#A7AEBC]">
              <span>
                {refSearchResults.length > 0
                  ? `${refSearchResults.length} results`
                  : t.tree.noSearchResults}
              </span>
              <button
                type="button"
                onClick={() => setRefSearchResults(null)}
                className="text-[#A7AEBC] hover:text-[#F2F0EB]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {refSearchResults.length > 0 && (
              <div className="space-y-1.5">
                {refSearchResults.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => void locateInReferralTree(hit.id)}
                    className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-[#08090B] px-3 py-2 text-left transition hover:border-[#CBB487]"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-[#F2F0EB]">{hit.displayName}</span>
                      <span className="font-mono-sgt ml-2 text-[#CBB487]">{hit.memberCode}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-[11px] text-[#A7AEBC]">
                      <span>L{hit.depth}</span>
                      <span>{hit.packageCode ?? hit.status}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-[#CBB487]" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Placement Search Dropdown Results */}
        {activeTab === "placement" && placeSearchResults !== null && (
          <div className="rounded-2xl border border-[#CBB487]/35 bg-[#141619] p-3 text-xs">
            <div className="mb-2 flex items-center justify-between text-[11px] text-[#A7AEBC]">
              <span>
                {placeSearchResults.length > 0
                  ? `${placeSearchResults.length} results`
                  : t.tree.noSearchResults}
              </span>
              <button
                type="button"
                onClick={() => setPlaceSearchResults(null)}
                className="text-[#A7AEBC] hover:text-[#F2F0EB]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {placeSearchResults.length > 0 && (
              <div className="space-y-1.5">
                {placeSearchResults.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => {
                      setPlaceSearchResults(null);
                      void loadPlacementFocus(hit.id, true);
                    }}
                    className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-[#08090B] px-3 py-2 text-left transition hover:border-[#CBB487]"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-[#F2F0EB]">{hit.displayName}</span>
                      <span className="font-mono-sgt ml-2 text-[#CBB487]">{hit.memberCode}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-[11px] text-[#A7AEBC]">
                      <span>
                        {hit.placementLeg ? (hit.placementLeg === "LEFT" ? "L" : "R") : "ROOT"} · L
                        {hit.depth}
                      </span>
                      <span>{hit.packageCode ?? hit.status}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-[#CBB487]" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== TAB 1: REFERRAL TREE ==================== */}
      {activeTab === "referral" && (
        <section className="space-y-3">
          {refError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/35 bg-[#141619] p-4 text-xs text-rose-300"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{refError}</span>
              </span>
              <button
                type="button"
                onClick={() => void loadReferralRoot()}
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border border-[#CBB487]/50 px-3 font-semibold text-[#CBB487]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{t.common.retry}</span>
              </button>
            </div>
          )}

          {refInitialLoading && !refRoot ? (
            <div className="flex min-h-[160px] items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-[#141619] p-8 text-xs text-[#A7AEBC]">
              <Loader2 className="h-4 w-4 animate-spin text-[#CBB487]" />
              <span>{t.common.loading}</span>
            </div>
          ) : refRoot ? (
            <>
              {/* Mobile Vertical Collapsible Branch Tree (< lg) */}
              <div className="lg:hidden">
                <MobileReferralBranch
                  node={refRoot}
                  rootId={refRoot.id}
                  depth={0}
                  expandedIds={refExpandedIds}
                  childrenMap={refChildrenMap}
                  loadingMap={refLoadingMap}
                  highlightedId={highlightedId}
                  t={t}
                  onToggleExpand={handleToggleReferralExpand}
                  onLoadMore={handleLoadMoreReferral}
                  onOpenDetail={(n) => setDetailModal({ source: "referral", node: n })}
                />
              </div>

              {/* Desktop Left-to-Right Branching Mindmap (>= lg) */}
              <div
                ref={desktopScrollRef}
                className="hidden overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#08090B] p-6 lg:block"
              >
                <div className="inline-block min-w-full">
                  <DesktopReferralBranch
                    node={refRoot}
                    rootId={refRoot.id}
                    depth={0}
                    expandedIds={refExpandedIds}
                    childrenMap={refChildrenMap}
                    loadingMap={refLoadingMap}
                    highlightedId={highlightedId}
                    t={t}
                    onToggleExpand={handleToggleReferralExpand}
                    onLoadMore={handleLoadMoreReferral}
                    onOpenDetail={(n) => setDetailModal({ source: "referral", node: n })}
                  />
                </div>
              </div>
            </>
          ) : null}
        </section>
      )}

      {/* ==================== TAB 2: PLACEMENT TREE ==================== */}
      {activeTab === "placement" && (
        <section className="space-y-4">
          {/* Root Member Own Left / Right Remaining BV & Headcount Overview */}
          {placeRootOverview && (
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141619]">
              <div className="border-b border-white/[0.06] px-4 py-2 text-[11px] font-medium text-[#A7AEBC]">
                {t.tree.rootOverviewLabel}
              </div>
              <div className="grid grid-cols-2 divide-x divide-white/[0.1]">
                <div className="p-3.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] bg-[#CBB487] text-[11px] font-bold text-[#08090B]">
                      L
                    </span>
                    <span className="text-xs text-[#D6D3CC]">
                      {t.common.left} ({placeRootOverview.leftCount})
                    </span>
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#56C9DC]" />
                  </div>
                  <div className="mt-2 tabular-nums text-lg font-bold text-[#F2F0EB]">
                    {formatBv(placeRootOverview.leftBv)}
                  </div>
                </div>
                <div className="p-3.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] bg-[#CBB487] text-[11px] font-bold text-[#08090B]">
                      R
                    </span>
                    <span className="text-xs text-[#D6D3CC]">
                      {t.common.right} ({placeRootOverview.rightCount})
                    </span>
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#A799F7]" />
                  </div>
                  <div className="mt-2 tabular-nums text-lg font-bold text-[#F2F0EB]">
                    {formatBv(placeRootOverview.rightBv)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Path Breadcrumb Navigation */}
          {placeBreadcrumbs.length > 0 && (
            <nav
              aria-label="Placement Path"
              className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.08] bg-[#141619] px-3 py-2 text-xs"
            >
              {placeBreadcrumbs.map((crumb, idx) => {
                const isLast = idx === placeBreadcrumbs.length - 1;
                return (
                  <div key={crumb.id} className="flex items-center gap-1">
                    {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-[#A7AEBC]" />}
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => void loadPlacementFocus(crumb.id, true)}
                      className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2 py-1 font-medium transition ${
                        isLast
                          ? "bg-[#CBB487]/15 text-[#CBB487]"
                          : "text-[#D6D3CC] hover:bg-white/[0.04] hover:text-[#F2F0EB]"
                      }`}
                    >
                      {crumb.leg && (
                        <span className="font-mono-sgt text-[10px] text-[#A7AEBC]">
                          {crumb.leg === "LEFT" ? "L" : "R"}·
                        </span>
                      )}
                      <span className="font-mono-sgt">{crumb.memberCode}</span>
                    </button>
                  </div>
                );
              })}
            </nav>
          )}

          {placeError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/35 bg-[#141619] p-4 text-xs text-rose-300"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{placeError}</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  void loadPlacementFocus(placeFocus?.id ?? initialFocusId, false)
                }
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border border-[#CBB487]/50 px-3 font-semibold text-[#CBB487]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{t.common.retry}</span>
              </button>
            </div>
          )}

          {placeLoading && !placeFocus ? (
            <div className="flex min-h-[180px] items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-[#141619] p-8 text-xs text-[#A7AEBC]">
              <Loader2 className="h-4 w-4 animate-spin text-[#CBB487]" />
              <span>{t.common.loading}</span>
            </div>
          ) : placeFocus ? (
            <div className="space-y-0">
              {/* Focus Node Card (Center, Champagne Gold Border) */}
              <div
                data-node-id={`place-${placeFocus.id}`}
                className={`mx-auto max-w-md rounded-2xl border border-[#CBB487] bg-[#141619] p-4 transition-all ${
                  highlightedId === placeFocus.id ? "r10-node-highlight" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailModal({ source: "placement", node: placeFocus })}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      {placeFocus.placementLeg && (
                        <span className="rounded bg-[#CBB487] px-1.5 py-0.5 text-[10px] font-bold text-[#08090B]">
                          {placeFocus.placementLeg === "LEFT" ? "L" : "R"}
                        </span>
                      )}
                      <span className="font-mono-sgt text-xs font-bold text-[#CBB487]">
                        {placeFocus.memberCode}
                      </span>
                      <span className="rounded border border-white/[0.08] bg-[#08090B] px-2 py-0.5 text-[10px] font-medium text-[#F2F0EB]">
                        {placeFocus.packageCode ?? "—"}
                      </span>
                      <StatusBadge status={placeFocus.status} />
                    </div>
                    <div className="mt-1.5 truncate text-base font-semibold text-[#F2F0EB]">
                      {placeFocus.displayName}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailModal({ source: "placement", node: placeFocus })}
                    className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-xl border border-white/[0.1] bg-[#08090B] px-2.5 text-[11px] font-medium text-[#CBB487] hover:border-[#CBB487]"
                  >
                    <Info className="h-3.5 w-3.5" />
                    <span>{t.tree.detailsBtn}</span>
                  </button>
                </div>

                {placeFocus.leftBv !== null && placeFocus.rightBv !== null && (
                  <div className="mt-3 grid grid-cols-2 divide-x divide-white/[0.1] rounded-xl border border-white/[0.07] bg-[#08090B] text-[11px]">
                    <div className="px-3 py-2">
                      <div className="text-[#56C9DC]">
                        L ({placeFocus.leftCount})
                      </div>
                      <div className="tabular-nums font-semibold text-[#F2F0EB]">
                        {formatBv(placeFocus.leftBv)}
                      </div>
                    </div>
                    <div className="px-3 py-2">
                      <div className="text-[#A799F7]">
                        R ({placeFocus.rightCount})
                      </div>
                      <div className="tabular-nums font-semibold text-[#F2F0EB]">
                        {formatBv(placeFocus.rightBv)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Fork Connector Hairlines to Left & Right Slots */}
              <div aria-hidden="true" className="mx-auto max-w-md px-12 sm:px-20">
                <div className="mx-auto h-4 w-px bg-[#CBB487]/50" />
                <div className="h-px w-full bg-[#CBB487]/50" />
                <div className="flex justify-between">
                  <div className="h-4 w-px bg-[#CBB487]/50" />
                  <div className="h-4 w-px bg-[#CBB487]/50" />
                </div>
              </div>

              {/* Side-by-Side L / R Immediate Children */}
              <div className="mx-auto grid max-w-2xl grid-cols-2 gap-2.5 sm:gap-4">
                {[
                  { leg: "LEFT" as const, label: "L", dot: "bg-[#56C9DC]", node: placeLeft },
                  { leg: "RIGHT" as const, label: "R", dot: "bg-[#A799F7]", node: placeRight },
                ].map((slot) =>
                  slot.node ? (
                    <div
                      key={slot.leg}
                      data-node-id={`place-${slot.node.id}`}
                      className={`min-w-0 rounded-2xl border border-white/[0.1] bg-[#141619] p-3 transition hover:border-[#CBB487]/65 sm:p-4 ${
                        highlightedId === slot.node.id ? "r10-node-highlight border-[#CBB487]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-[#CBB487] text-[11px] font-bold text-[#08090B]">
                            {slot.label}
                          </span>
                          <span className={`h-1.5 w-1.5 rounded-full ${slot.dot}`} />
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setDetailModal({ source: "placement", node: slot.node! })
                          }
                          aria-label={`${slot.node.displayName} ${t.tree.detailsBtn}`}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-white/[0.08] bg-[#08090B] px-2 text-[10px] font-medium text-[#CBB487] hover:border-[#CBB487]"
                        >
                          <Info className="h-3 w-3" />
                          <span className="hidden sm:inline">{t.tree.detailsBtn}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => void loadPlacementFocus(slot.node!.id, true)}
                        className="mt-2.5 block w-full min-w-0 text-left"
                      >
                        <div className="font-mono-sgt truncate text-xs font-bold text-[#CBB487]">
                          {slot.node.memberCode}
                        </div>
                        <div className="mt-0.5 truncate text-sm font-semibold text-[#F2F0EB]">
                          {slot.node.displayName}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="rounded border border-white/[0.08] bg-[#08090B] px-1.5 py-0.5 text-[10px] text-[#F2F0EB]">
                            {slot.node.packageCode ?? "—"}
                          </span>
                          <StatusBadge status={slot.node.status} />
                        </div>

                        {slot.node.leftBv !== null && slot.node.rightBv !== null && (
                          <div className="mt-2.5 rounded-lg border border-white/[0.06] bg-[#08090B] px-2 py-1.5 text-[10px] tabular-nums text-[#A7AEBC]">
                            L {slot.node.leftCount} · R {slot.node.rightCount}
                          </div>
                        )}

                        <div className="mt-2 flex items-center justify-between text-[11px] text-[#CBB487]">
                          <span className="truncate">{t.tree.drillDownHint}</span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        </div>
                      </button>
                    </div>
                  ) : (
                    <div
                      key={slot.leg}
                      className="flex min-h-[140px] flex-col justify-between rounded-2xl border border-dashed border-white/[0.12] bg-[#141619]/40 p-3 sm:p-4"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] border border-white/15 bg-[#08090B] text-[11px] font-bold text-[#A7AEBC]">
                          {slot.label}
                        </span>
                        <span className={`h-1.5 w-1.5 rounded-full opacity-50 ${slot.dot}`} />
                      </div>
                      <div className="py-4 text-center text-xs text-[#A7AEBC]">
                        {t.tree.emptySlot}
                      </div>
                      <div />
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}
        </section>
      )}

      {/* ==================== MEMBER DETAIL BOTTOM DRAWER ==================== */}
      <BottomDrawer
        open={Boolean(detailModal)}
        onClose={() => setDetailModal(null)}
        title={t.tree.nodeDetailTitle}
      >
        {detailModal?.source === "referral" && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-[#CBB487]/35 bg-[#08090B] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-sgt text-sm font-bold text-[#CBB487]">
                  {detailModal.node.memberCode}
                </span>
                <StatusBadge status={detailModal.node.status} />
              </div>
              <div className="mt-1 text-base font-semibold text-[#F2F0EB]">
                {detailModal.node.displayName}
              </div>
            </div>

            <div className="space-y-2.5 rounded-xl border border-white/[0.08] bg-[#08090B] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#A7AEBC]">{t.tree.sponsorLabel}</span>
                <span className="font-medium text-[#F2F0EB]">
                  {detailModal.node.sponsorCode
                    ? `${detailModal.node.sponsorCode} (${detailModal.node.sponsorName})`
                    : "Root"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#A7AEBC]">{t.tree.directCountLabel}</span>
                <span className="inline-flex items-center gap-1 tabular-nums font-semibold text-[#CBB487]">
                  <Users className="h-3.5 w-3.5" />
                  <span>{detailModal.node.directCount}</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#A7AEBC]">{t.tree.packageStatusLabel}</span>
                <span className="font-semibold text-[#F2F0EB]">
                  {detailModal.node.packageCode ?? "—"} · {detailModal.node.status}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#A7AEBC]">{t.tree.placementParentLabel}</span>
                <span className="font-mono-sgt text-[#D6D3CC]">
                  {detailModal.node.placementParentCode
                    ? `${detailModal.node.placementParentCode} (${detailModal.node.placementLeg === "LEFT" ? "L" : "R"})`
                    : "Pending"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2">
                <span className="text-[#A7AEBC]">{t.tree.joinedAtLabel}</span>
                <span className="font-mono-sgt text-[#A7AEBC]">
                  {detailModal.node.joinedAtLabel}
                </span>
              </div>
            </div>
          </div>
        )}

        {detailModal?.source === "placement" && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-[#CBB487]/35 bg-[#08090B] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-sgt text-sm font-bold text-[#CBB487]">
                  {detailModal.node.memberCode}
                </span>
                <StatusBadge status={detailModal.node.status} />
              </div>
              <div className="mt-1 text-base font-semibold text-[#F2F0EB]">
                {detailModal.node.displayName}
              </div>
            </div>

            <div className="space-y-2.5 rounded-xl border border-white/[0.08] bg-[#08090B] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#A7AEBC]">{t.tree.placementParentLabel}</span>
                <span className="font-medium text-[#F2F0EB]">
                  {detailModal.node.placementParentCode
                    ? `${detailModal.node.placementParentCode} (${detailModal.node.placementParentName})`
                    : "Root"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#A7AEBC]">{t.tree.placementLegLabel}</span>
                <span className="font-mono-sgt font-semibold text-[#CBB487]">
                  {detailModal.node.placementLeg
                    ? detailModal.node.placementLeg === "LEFT"
                      ? "LEFT (L)"
                      : "RIGHT (R)"
                    : "ROOT"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#A7AEBC]">{t.tree.sponsorLabel}</span>
                <span className="font-mono-sgt text-[#D6D3CC]">
                  {detailModal.node.sponsorCode ?? "Root"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#A7AEBC]">{t.tree.packageStatusLabel}</span>
                <span className="font-semibold text-[#F2F0EB]">
                  {detailModal.node.packageCode ?? "—"} · {detailModal.node.status}
                </span>
              </div>
              {detailModal.node.leftBv !== null && detailModal.node.rightBv !== null && (
                <div className="grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-2.5">
                  <div>
                    <div className="text-[#56C9DC]">
                      L ({detailModal.node.leftCount})
                    </div>
                    <div className="tabular-nums font-semibold text-[#F2F0EB]">
                      {formatBv(detailModal.node.leftBv)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#A799F7]">
                      R ({detailModal.node.rightCount})
                    </div>
                    <div className="tabular-nums font-semibold text-[#F2F0EB]">
                      {formatBv(detailModal.node.rightBv)}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2">
                <span className="text-[#A7AEBC]">{t.tree.joinedAtLabel}</span>
                <span className="font-mono-sgt text-[#A7AEBC]">
                  {detailModal.node.joinedAtLabel}
                </span>
              </div>
            </div>

            {detailModal.node.inReferralSubtree && (
              <button
                type="button"
                onClick={() => {
                  const targetId = detailModal.node.id;
                  setDetailModal(null);
                  setActiveTab("referral");
                  void locateInReferralTree(targetId);
                }}
                className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#CBB487] text-sm font-semibold text-[#08090B] transition active:scale-[0.98]"
              >
                <GitBranch className="h-4 w-4" />
                <span>{t.tree.viewInReferralTree}</span>
              </button>
            )}

            {detailModal.node.id !== viewerId && (
              <button
                type="button"
                onClick={() => {
                  const targetId = detailModal.node.id;
                  setDetailModal(null);
                  void loadPlacementFocus(targetId, true);
                }}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-[#08090B] text-xs font-medium text-[#F2F0EB] hover:border-[#CBB487]/60"
              >
                <Eye className="h-4 w-4 text-[#CBB487]" />
                <span>{t.tree.drillDownHint}</span>
              </button>
            )}
          </div>
        )}
      </BottomDrawer>
    </div>
  );
}
