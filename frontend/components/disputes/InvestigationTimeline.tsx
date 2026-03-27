"use client";

import { Database, Landmark, FileText, Search, Calculator, RotateCcw, CheckCircle2, XCircle } from "lucide-react";

interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  output: string;
}

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  query_isw_transaction: Database,
  query_bank_transactions: Landmark,
  query_erp_invoices: FileText,
  get_customer_dispute_history: Search,
  get_customer_history: Search,
  calculate_settlement_breakdown: Calculator,
  decompose_settlement: Calculator,
  execute_refund: RotateCcw,
};

const TOOL_COLORS: Record<string, { text: string; border: string }> = {
  query_isw_transaction:          { text: "text-sg-info",    border: "border-sg-info/30" },
  query_bank_transactions:        { text: "text-sg-matched", border: "border-sg-matched/30" },
  query_erp_invoices:             { text: "text-purple-400", border: "border-purple-400/30" },
  get_customer_dispute_history:   { text: "text-sg-pending", border: "border-sg-pending/30" },
  get_customer_history:           { text: "text-sg-pending", border: "border-sg-pending/30" },
  calculate_settlement_breakdown: { text: "text-sg-orphan",  border: "border-sg-orphan/30" },
  decompose_settlement:           { text: "text-sg-orphan",  border: "border-sg-orphan/30" },
  execute_refund:                 { text: "text-sg-mismatch", border: "border-sg-mismatch/30" },
};

function formatToolName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function tryParseJSON(str: string): unknown {
  try { return JSON.parse(str); } catch { return null; }
}

function isSuccessOutput(output: string): boolean {
  const lower = output.toLowerCase();
  return !lower.includes("error") && !lower.includes("not found") && !lower.includes("no record");
}

export function InvestigationTimeline({ toolCalls }: { toolCalls: ToolCall[] }) {
  return (
    <div className="mt-3 relative">
      {/* Vertical line */}
      <div className="absolute left-[13px] top-3 bottom-3 w-px bg-sg-border" />

      <div className="space-y-2">
        {toolCalls.map((tc, i) => {
          const Icon = TOOL_ICONS[tc.tool] || Search;
          const colors = TOOL_COLORS[tc.tool] || { text: "text-sg-text-secondary", border: "border-sg-border" };
          const success = isSuccessOutput(tc.output);
          const parsed = tryParseJSON(tc.output);
          const outputPreview = parsed
            ? JSON.stringify(parsed, null, 2).substring(0, 200)
            : tc.output.substring(0, 200);

          return (
            <div
              key={i}
              className="flex gap-3 pl-0.5 animate-sg-step-fade"
              style={{ animationDelay: `${i * 300}ms` }}
            >
              {/* Step dot */}
              <div className={`relative z-10 w-[26px] h-[26px] rounded-full bg-sg-bg border-2 ${colors.border} flex items-center justify-center shrink-0`}>
                <Icon className={`w-3 h-3 ${colors.text}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[11px] font-mono font-semibold ${colors.text}`}>
                    Step {i + 1}: {formatToolName(tc.tool)}
                  </span>
                  {success ? (
                    <CheckCircle2 className="w-3 h-3 text-sg-matched" />
                  ) : (
                    <XCircle className="w-3 h-3 text-sg-mismatch" />
                  )}
                </div>

                <div className="bg-sg-bg-hover/50 rounded-sm px-3 py-1.5 mb-1">
                  <span className="text-sg-text-tertiary text-[10px] font-mono">
                    {JSON.stringify(tc.input)}
                  </span>
                </div>

                <div className="bg-sg-bg/50 rounded-sm px-3 py-1.5">
                  <pre className="text-sg-text-secondary text-[10px] font-mono whitespace-pre-wrap max-h-20 overflow-y-auto sg-scrollbar">
                    {outputPreview}
                    {(parsed ? JSON.stringify(parsed, null, 2).length : tc.output.length) > 200 && "..."}
                  </pre>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
