"use client";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  full_match: { label: "Full Match", bg: "bg-emerald-900/50", text: "text-emerald-400" },
  isw_erp_match: { label: "ISW+ERP Match", bg: "bg-blue-900/50", text: "text-blue-400" },
  isw_bank_match: { label: "ISW+Bank Match", bg: "bg-blue-900/50", text: "text-blue-400" },
  settlement_pending: { label: "Settlement Pending", bg: "bg-yellow-900/50", text: "text-yellow-400" },
  amount_mismatch: { label: "Amount Mismatch", bg: "bg-orange-900/50", text: "text-orange-400" },
  orphan_isw: { label: "Orphan (ISW)", bg: "bg-red-900/50", text: "text-red-400" },
  orphan_bank: { label: "Orphan (Bank)", bg: "bg-red-900/50", text: "text-red-400" },
  orphan_invoice: { label: "Orphan (Invoice)", bg: "bg-red-900/50", text: "text-red-400" },
  duplicate_detected: { label: "Duplicate", bg: "bg-purple-900/50", text: "text-purple-400" },
  success: { label: "Success", bg: "bg-emerald-900/50", text: "text-emerald-400" },
  failed: { label: "Failed", bg: "bg-red-900/50", text: "text-red-400" },
  pending: { label: "Pending", bg: "bg-yellow-900/50", text: "text-yellow-400" },
};

export function MatchStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || {
    label: status.replace(/_/g, " "),
    bg: "bg-gray-700",
    text: "text-gray-300",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}
