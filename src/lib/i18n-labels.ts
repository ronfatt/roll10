import type { Locale } from "@/lib/i18n";

export function formatLegLabel(leg: string | null | undefined, locale: Locale): string {
  if (!leg) return locale === "zh-CN" ? "无" : "NONE";
  if (locale === "zh-CN") {
    switch (leg) {
      case "LEFT":
        return "左区";
      case "RIGHT":
        return "右区";
      case "NONE":
        return "无";
      default:
        return leg;
    }
  }
  return leg;
}

export function formatMemberStatus(status: string, locale: Locale): string {
  if (locale !== "zh-CN") return status;
  switch (status) {
    case "ACTIVE":
      return "已激活";
    case "PENDING_PAYMENT":
      return "待付款";
    case "SUSPENDED":
      return "已暂停";
    case "CANCELLED":
      return "已取消";
    default:
      return status;
  }
}

export function formatOrderType(orderType: string, locale: Locale): string {
  if (locale !== "zh-CN") return orderType;
  switch (orderType) {
    case "INITIAL":
      return "首单入会";
    case "UPGRADE":
      return "配套升级";
    default:
      return orderType;
  }
}

export function formatOrderStatus(status: string, locale: Locale): string {
  if (locale !== "zh-CN") return status;
  switch (status) {
    case "PENDING_PAYMENT":
      return "待付款";
    case "PENDING_CONFIRMATION":
      return "待确认";
    case "CONFIRMED":
      return "已确认";
    case "PAID":
      return "已付款";
    case "UNPAID":
      return "未付款";
    case "FAILED":
      return "已失败";
    case "CANCELLED":
      return "已取消";
    case "REJECTED":
      return "已驳回";
    default:
      return status;
  }
}

export function formatEffectiveStatus(status: string, locale: Locale): string {
  if (locale !== "zh-CN") return status;
  switch (status) {
    case "WAITING_EFFECTIVE":
      return "等待生效";
    case "EFFECTIVE":
      return "已生效";
    case "NOT_APPLICABLE":
      return "不适用";
    case "FAILED":
      return "已失效";
    default:
      return status;
  }
}

export function formatDepositVerifyStatus(status: string | null | undefined, locale: Locale): string {
  if (!status) return locale === "zh-CN" ? "未提交" : "UNSUBMITTED";
  if (locale !== "zh-CN") return status;
  switch (status) {
    case "UNSUBMITTED":
      return "未提交";
    case "AWAITING_TX":
      return "待提交 TxID";
    case "VERIFYING":
      return "链上核验中";
    case "VERIFIED_MATCH":
      return "核验通过";
    case "MATCHED_CONFIRMED":
      return "已匹配确认";
    case "MANUAL_REVIEW":
      return "人工复核中";
    case "REJECTED":
      return "已驳回";
    case "CONFIRMED":
      return "已确认";
    case "FAILED":
    case "FAILED_MISMATCH":
      return "核验失败";
    default:
      return status;
  }
}

export function formatEntryTypeLabel(entryType: string, locale: Locale): string {
  if (locale !== "zh-CN") return entryType;
  switch (entryType) {
    case "DIRECT_COMMISSION":
      return "直推奖励";
    case "BINARY_PAIRING":
      return "对碰奖金";
    case "WITHDRAWAL_LOCK":
      return "提现冻结";
    case "WITHDRAWAL_RELEASE":
      return "提现解冻退回";
    case "WITHDRAWAL_PAID":
      return "提现出款";
    case "WITHDRAWAL_REJECT_REFUND":
      return "提现退回";
    case "ADMIN_ADJUSTMENT":
      return "后台调整";
    default:
      return entryType;
  }
}

export function formatBvEventType(eventType: string, locale: Locale): string {
  if (locale !== "zh-CN") return eventType;
  switch (eventType) {
    case "JOIN":
      return "入会新增";
    case "UPGRADE":
      return "升级新增";
    case "EOD_FLUSH":
      return "日终清零";
    case "PAIRING_DEDUCT":
      return "对碰扣除";
    case "ADMIN_ADJUSTMENT":
      return "后台调整";
    default:
      return eventType;
  }
}

export function formatTriggerTypeLabel(triggerType: string, locale: Locale): string {
  if (locale !== "zh-CN") return triggerType;
  switch (triggerType) {
    case "ORDER_CONFIRM":
    case "INSTANT_ORDER":
      return "订单确认触发";
    case "SCHEDULED_UPGRADE":
    case "UPGRADE_CATCHUP":
      return "升级生效触发";
    case "LAZY_CATCHUP":
      return "惰性补算触发";
    case "MANUAL_RECONCILE":
      return "人工对账触发";
    default:
      return triggerType;
  }
}

export function formatDecisionBasisLabel(basis: string, locale: Locale): string {
  if (locale !== "zh-CN") return basis;
  switch (basis) {
    case "HIGHER_BV_LEFT":
      return "左区 BV 较高（保留左区）";
    case "HIGHER_BV_RIGHT":
      return "右区 BV 较高（保留右区）";
    case "TIE_HEADCOUNT_LEFT":
      return "双边 BV 相同 · 左区人数较多（保留左区）";
    case "TIE_HEADCOUNT_RIGHT":
      return "双边 BV 相同 · 右区人数较多（保留右区）";
    case "TIE_RULE_KEEP_LEFT":
      return "双边同分同人数 · 默认保留左区";
    case "TIE_RULE_KEEP_RIGHT":
      return "双边同分同人数 · 默认保留右区";
    case "NONE":
      return "暂无保留方向";
    default:
      return basis;
  }
}

export function formatWithdrawalStatusLabel(status: string, locale: Locale): string {
  if (locale !== "zh-CN") return status;
  switch (status) {
    case "PENDING_APPROVAL":
      return "待审核";
    case "APPROVED":
      return "已批准待打款";
    case "CHAIN_CONFIRMING":
      return "链上出款中";
    case "PAYOUT_PENDING_CHECK":
      return "待二次核验";
    case "PAID":
      return "已打款完成";
    case "REJECTED":
      return "已驳回";
    default:
      return status;
  }
}

export function formatVerificationStatusLabel(status: string, locale: Locale): string {
  if (locale !== "zh-CN") return status;
  switch (status) {
    case "SUCCESS":
      return "成功";
    case "FAILED":
      return "失败";
    case "PENDING":
      return "核验中";
    default:
      return status;
  }
}

export function formatPlanName(planName: string, locale: Locale): string {
  if (locale !== "zh-CN") return planName;
  return planName.replace(/\s*Plan$/i, " 配套");
}

export function formatSideTitle(side: "L" | "R" | "LEFT" | "RIGHT", locale: Locale): string {
  const isLeft = side === "L" || side === "LEFT";
  if (locale === "zh-CN") {
    return isLeft ? "L 左区" : "R 右区";
  }
  return isLeft ? "L (Left)" : "R (Right)";
}
