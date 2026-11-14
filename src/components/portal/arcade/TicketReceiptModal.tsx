"use client";

import { CheckCircle2, ChevronRight, Hash, Sparkles, X } from "lucide-react";
import type { BetTicket } from "./types";

interface TicketReceiptModalProps {
  ticket: BetTicket | null;
  onClose: () => void;
  onViewMyTickets: () => void;
  isZh?: boolean;
}

export function TicketReceiptModal({
  ticket,
  onClose,
  onViewMyTickets,
  isZh = true,
}: TicketReceiptModalProps) {
  if (!ticket) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#E9C66B]/50 bg-[#10171B] p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9),0_0_25px_rgba(233,198,107,0.2)]">
        {/* Subtle decorative glow */}
        <div
          aria-hidden="true"
          className="absolute -top-16 -right-16 h-36 w-36 rounded-full bg-[#E9C66B]/15 blur-2xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-16 -left-16 h-36 w-36 rounded-full bg-[#00D9DF]/15 blur-2xl pointer-events-none"
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label={isZh ? "关闭" : "Close"}
          className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-lg border border-[#29363D] bg-[#172126] text-[#829098] hover:text-[#F4F6F7] hover:border-[#00D9DF] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header with Green Badge & Trophy */}
        <div className="text-center pt-1">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#52C898]/40 bg-[#52C898]/10 text-[#52C898] shadow-[0_0_15px_rgba(82,200,152,0.3)]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="mt-2 text-base sm:text-lg font-black tracking-tight text-[#F4F6F7]">
            {isZh ? "下注成功 · 竞速注单已生成" : "Bet Confirmed · Ticket Issued"}
          </h3>
          <p className="mt-0.5 text-xs text-[#829098]">
            {isZh ? "系统已锁定当期盘口并存证" : "Market locked & registered in session"}
          </p>
        </div>

        {/* Ticket Card Voucher */}
        <div className="mt-4 rounded-xl border border-[#29363D] bg-[#070B0D] p-3.5 space-y-2.5 text-xs relative">
          {/* Perforated edge effect */}
          <div className="flex items-center justify-between pb-2 border-b border-dashed border-[#29363D]">
            <div className="flex items-center gap-1.5 text-[#B0BBC2]">
              <Hash className="h-3.5 w-3.5 text-[#E9C66B]" />
              <span className="font-mono text-[11px] text-[#F4F6F7] font-semibold tracking-wider">
                {ticket.ticketId}
              </span>
            </div>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#52C898]/15 text-[#52C898] border border-[#52C898]/30">
              {isZh ? "正在受注" : "Accepted"}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[#829098]">
              <span>{isZh ? "竞速期号" : "Race Issue"}</span>
              <span className="font-mono text-[#F4F6F7] font-medium">第 {ticket.issueNo} 期</span>
            </div>
            <div className="flex items-center justify-between text-[#829098]">
              <span>{isZh ? "下注玩法" : "Market"}</span>
              <span className="font-medium text-[#00D9DF]">{ticket.marketLabel}</span>
            </div>
            <div className="flex items-center justify-between text-[#829098]">
              <span>{isZh ? "投注内容" : "Selection"}</span>
              <span className="font-bold text-[#F4F6F7]">{ticket.pickDetail}</span>
            </div>
            <div className="flex items-center justify-between text-[#829098]">
              <span>{isZh ? "锁定赔率" : "Fixed Odds"}</span>
              <span className="font-mono font-bold text-[#E9C66B]">{ticket.odds.toFixed(2)}x</span>
            </div>
          </div>

          {/* Stake & Projected Return Box */}
          <div className="mt-2 rounded-lg border border-[#E9C66B]/30 bg-[#172126] p-2.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[#829098]">{isZh ? "投注金额" : "Stake"}</p>
              <p className="text-sm font-mono font-bold text-[#F4F6F7]">
                {ticket.stakeCp.toFixed(2)}{" "}
                <span className="text-[10px] font-normal text-[#E9C66B]">CP</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#829098]">{isZh ? "预计最高返还" : "Max Return"}</p>
              <p className="text-sm font-mono font-black text-[#52C898]">
                {ticket.projectedReturnCp.toFixed(2)}{" "}
                <span className="text-[10px] font-normal text-[#52C898]">CP</span>
              </p>
            </div>
          </div>

          {/* Ticket Barcode Motif */}
          <div className="pt-1 flex flex-col items-center justify-center opacity-40">
            <div className="h-5 w-44 flex items-center justify-between gap-[2px]">
              {Array.from({ length: 28 }).map((_, i) => (
                <span
                  key={i}
                  className="h-full bg-white/70"
                  style={{ width: `${(i % 3) + 1}px` }}
                />
              ))}
            </div>
            <span className="font-mono text-[9px] tracking-widest text-[#829098] mt-0.5">
              ROLL10-SPEED-SYSTEM
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onViewMyTickets();
            }}
            className="flex-1 r10-btn-dark py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 text-[#00D9DF] border-[#00D9DF]/40"
          >
            <span>{isZh ? "查看我的注单" : "My Bet Slips"}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 r10-btn-gold py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isZh ? "继续选号" : "Keep Betting"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
