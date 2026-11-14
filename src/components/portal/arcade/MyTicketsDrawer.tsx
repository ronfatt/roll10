"use client";

import { useState } from "react";
import { CheckCircle2, Clock, History, Trophy, X, XCircle } from "lucide-react";
import type { BetTicket } from "./types";

interface MyTicketsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: BetTicket[];
  isZh?: boolean;
}

export function MyTicketsDrawer({
  isOpen,
  onClose,
  tickets,
  isZh = true,
}: MyTicketsDrawerProps) {
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "SETTLED">("ALL");

  if (!isOpen) return null;

  const filteredTickets = tickets.filter((t) => {
    if (filter === "PENDING") return t.status === "PENDING";
    if (filter === "SETTLED") return t.status !== "PENDING";
    return true;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-[#29363D] bg-[#10171B] p-4 sm:p-5 shadow-2xl animate-in slide-in-from-right duration-250">
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#29363D]">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9C66B]/15 text-[#E9C66B] border border-[#E9C66B]/30">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F4F6F7]">
                {isZh ? "我的注单" : "My Bet Slips"}
              </h2>
              <p className="text-[11px] text-[#829098]">
                {isZh ? `共 ${tickets.length} 张注单记录` : `${tickets.length} tickets recorded`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isZh ? "关闭" : "Close"}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#29363D] bg-[#172126] text-[#829098] hover:text-[#F4F6F7] hover:border-[#00D9DF] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "ALL"
                ? "bg-[#00D9DF] text-[#070B0D] shadow-[0_0_10px_rgba(0,217,223,0.3)]"
                : "border border-[#29363D] bg-[#070B0D] text-[#829098]"
            }`}
          >
            {isZh ? "全部" : "All"} ({tickets.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("PENDING")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "PENDING"
                ? "bg-[#00D9DF] text-[#070B0D] shadow-[0_0_10px_rgba(0,217,223,0.3)]"
                : "border border-[#29363D] bg-[#070B0D] text-[#829098]"
            }`}
          >
            {isZh ? "待开奖" : "Pending"} ({tickets.filter((t) => t.status === "PENDING").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("SETTLED")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "SETTLED"
                ? "bg-[#00D9DF] text-[#070B0D] shadow-[0_0_10px_rgba(0,217,223,0.3)]"
                : "border border-[#29363D] bg-[#070B0D] text-[#829098]"
            }`}
          >
            {isZh ? "已结算" : "Settled"} ({tickets.filter((t) => t.status !== "PENDING").length})
          </button>
        </div>

        {/* Ticket List Body */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1">
          {filteredTickets.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-[#29363D] bg-[#070B0D]">
              <History className="h-8 w-8 text-[#829098]/50" />
              <p className="mt-2 text-xs font-medium text-[#829098]">
                {isZh ? "暂无相关注单" : "No tickets found"}
              </p>
              <p className="text-[10px] text-[#829098]/70 mt-0.5">
                {isZh ? "挑选心仪钢珠，立即体验赛道下注" : "Pick a steel ball to place your first bet"}
              </p>
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <div
                key={ticket.ticketId}
                className="rounded-xl border border-[#29363D] bg-[#070B0D] p-3 space-y-2 relative overflow-hidden"
              >
                {/* Status colored accent ribbon */}
                <div
                  className={`absolute top-0 left-0 bottom-0 w-1 ${
                    ticket.status === "PENDING"
                      ? "bg-[#00D9DF]"
                      : ticket.status === "WON"
                        ? "bg-[#52C898]"
                        : "bg-neutral-600"
                  }`}
                />

                <div className="flex items-center justify-between text-xs pl-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-[#B0BBC2] font-semibold">
                      {ticket.ticketId}
                    </span>
                    <span className="text-[10px] text-[#829098]">
                      · 第 {ticket.issueNo} 期
                    </span>
                  </div>

                  {ticket.status === "PENDING" && (
                    <span className="flex items-center gap-1 text-[10px] text-[#00D9DF] font-medium bg-[#00D9DF]/10 px-2 py-0.5 rounded border border-[#00D9DF]/30">
                      <Clock className="h-3 w-3 animate-spin" />
                      {isZh ? "正在受注" : "Pending"}
                    </span>
                  )}
                  {ticket.status === "WON" && (
                    <span className="flex items-center gap-1 text-[10px] text-[#52C898] font-bold bg-[#52C898]/15 px-2 py-0.5 rounded border border-[#52C898]/30">
                      <Trophy className="h-3 w-3" />
                      {isZh ? "中奖派彩" : "Won"}
                    </span>
                  )}
                  {ticket.status === "LOST" && (
                    <span className="flex items-center gap-1 text-[10px] text-[#829098] font-medium bg-neutral-800/80 px-2 py-0.5 rounded border border-[#29363D]">
                      <XCircle className="h-3 w-3" />
                      {isZh ? "未中奖" : "Lost"}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pl-2 text-xs">
                  <div>
                    <span className="text-[10px] text-[#829098]">{ticket.marketLabel}</span>
                    <p className="font-bold text-[#F4F6F7]">{ticket.pickDetail}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#829098]">{isZh ? "赔率" : "Odds"}</span>
                    <p className="font-mono font-bold text-[#E9C66B]">{ticket.odds.toFixed(2)}x</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-[#29363D]/60 pl-2 text-xs">
                  <div className="text-[#829098]">
                    <span>{isZh ? "下注: " : "Stake: "}</span>
                    <span className="font-mono text-[#F4F6F7] font-semibold">
                      {ticket.stakeCp.toFixed(2)} CP
                    </span>
                  </div>
                  <div className="text-right">
                    {ticket.status === "WON" ? (
                      <span className="font-mono font-bold text-[#52C898]">
                        +{ticket.actualPayoutCp?.toFixed(2) ?? ticket.projectedReturnCp.toFixed(2)} CP
                      </span>
                    ) : ticket.status === "LOST" ? (
                      <span className="font-mono text-neutral-500">0.00 CP</span>
                    ) : (
                      <span className="font-mono text-[#829098]">
                        {isZh ? "预计 " : "Exp. "}
                        <span className="text-[#00D9DF] font-bold">
                          {ticket.projectedReturnCp.toFixed(2)}
                        </span>{" "}
                        CP
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Close */}
        <div className="pt-3 border-t border-[#29363D]">
          <button
            type="button"
            onClick={onClose}
            className="w-full r10-btn-dark py-2.5 rounded-xl text-xs font-semibold"
          >
            {isZh ? "返回游戏厅" : "Back to Arcade"}
          </button>
        </div>
      </div>
    </div>
  );
}
