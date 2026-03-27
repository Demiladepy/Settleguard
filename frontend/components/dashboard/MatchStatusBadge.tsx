"use client";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  full_match:         { label: "Matched",            color: "text-sg-matched",  bg: "bg-sg-matched/10" },
  isw_erp_match:      { label: "ISW+ERP",            color: "text-sg-info",     bg: "bg-sg-info/10" },
  isw_bank_match:     { label: "ISW+Bank",           color: "text-sg-info",     bg: "bg-sg-info/10" },
  settlement_pending: { label: "Pending",            color: "text-sg-pending",  bg: "bg-sg-pending/10" },
  amount_mismatch:    { label: "Mismatch",           color: "text-sg-mismatch", bg: "bg-sg-mismatch/10" },
  orphan_isw:         { label: "Orphan",             color: "text-sg-orphan",   bg: "bg-sg-orphan/10" },
  orphan_bank:        { label: "Orphan (Bank)",      color: "text-sg-orphan",   bg: "bg-sg-orphan/10" },
  orphan_invoice:     { label: "Orphan (Invoice)",   color: "text-sg-orphan",   bg: "bg-sg-orphan/10" },
  duplicate_detected: { label: "Duplicate",          color: "text-purple-400",  bg: "bg-purple-400/10" },
  success:            { label: "Success",            color: "text-sg-matched",  bg: "bg-sg-matched/10" },
  failed:             { label: "Failed",             color: "text-sg-mismatch", bg: "bg-sg-mismatch/10" },
  pending:            { label: "Pending",            color: "text-sg-pending",  bg: "bg-sg-pending/10" },
  refund:             { label: "Refund",             color: "text-sg-mismatch", bg: "bg-sg-mismatch/10" },
  escalate:           { label: "Escalate",           color: "text-sg-pending",  bg: "bg-sg-pending/10" },
  reject:             { label: "Reject",             color: "text-sg-text-tertiary", bg: "bg-sg-bg-hover" },
  wait:               { label: "Wait",               color: "text-sg-pending",  bg: "bg-sg-pending/10" },
  auto_resolved:      { label: "Auto-resolved",      color: "text-sg-matched",  bg: "bg-sg-matched/10" },
};

export function MatchStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || {
    label: status.replace(/_/g, " "),
    color: "text-sg-text-secondary",
    bg: "bg-sg-bg-hover",
  };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium font-mono tracking-wide uppercase ${config.bg} ${config.color}`}
    >
      {config.label}
    </span>
  );
}
