export type MarketType = "WIN_PLACE" | "SIDE_BETS" | "EXACTA";
export type SubMarketWinPlace = "WIN" | "PLACE";
export type SubMarketExacta = "QUINELLA" | "EXACTA";

export interface SteelBall {
  num: number;
  nameZh: string;
  nameEn: string;
  colorName: string;
  badgeBg: string;
  badgeText: string;
  glowColor: string;
  gradient: string;
  ringColor: string;
  winOdds: number; // 9.60x
  placeOdds: number; // 3.10x
  speedRating: number; // e.g. 98
  recentForm: number[]; // recent finish ranks e.g. [1, 2, 4, 1, 3]
}

export interface SelectedBet {
  id: string;
  marketType: MarketType;
  subType: string;
  label: string;
  pickDetail: string;
  odds: number;
  ballNums?: number[];
}

export type TicketStatus = "PENDING" | "WON" | "LOST";

export interface BetTicket {
  ticketId: string;
  issueNo: string;
  placedAt: string;
  marketLabel: string;
  pickDetail: string;
  stakeCp: number;
  odds: number;
  projectedReturnCp: number;
  status: TicketStatus;
  settledAt?: string;
  actualPayoutCp?: number;
}

export interface IssueHistory {
  issue: string;
  winner: number;
  second: number;
  third: number;
  bigSmall: "大" | "小";
  oddEven: "单" | "双";
}
