"use client";

import { Database, Landmark, FileText, Search, Calculator, RotateCcw } from "lucide-react";

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

const TOOL_COLORS: Record<string, string> = {
  query_isw_transaction: "text-blue-400 border-blue-800/40",
  query_bank_transactions: "text-emerald-400 border-emerald-800/40",
  query_erp_invoices: "text-purple-400 border-purple-800/40",
  get_customer_dispute_history: "text-yellow-400 border-yellow-800/40",
  get_customer_history: "text-yellow-400 border-yellow-800/40",
  calculate_settlement_breakdown: "text-orange-400 border-orange-800/40",
  decompose_settlement: "text-orange-400 border-orange-800/40",
  execute_refund: "text-red-400 border-red-800/40",
};

function formatToolName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function tryParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export function InvestigationTimeline({ toolCalls }: { toolCalls: ToolCall[] }) {
  return (
    <div className="mt-3 relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-700" />

      <div className="space-y-3">
        {toolCalls.map((tc, i) => {
          const Icon = TOOL_ICONS[tc.tool] || Search;
          const color = TOOL_COLORS[tc.tool] || "text-gray-400 border-gray-700";
          const [textColor, borderColor] = color.split(" ");
          const parsed = tryParseJSON(tc.output);
          const outputPreview = parsed
            ? JSON.stringify(parsed, null, 2).substring(0, 200)
            : tc.output.substring(0, 200);

          return (
            <div key={i} className="flex gap-3 pl-1">
              {/* Step indicator */}
              <div
                className={`relative z-10 w-7 h-7 rounded-full bg-gray-900 border-2 ${borderColor} flex items-center justify-center shrink-0`}
              >
                <Icon className={`w-3.5 h-3.5 ${textColor}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold ${textColor}`}>
                    Step {i + 1}: {formatToolName(tc.tool)}
                  </span>
                </div>

                {/* Input */}
                <div className="bg-gray-800/30 rounded px-3 py-1.5 mb-1">
                  <span className="text-gray-500 text-xs">Input: </span>
                  <span className="text-gray-300 text-xs font-mono">
                    {JSON.stringify(tc.input)}
                  </span>
                </div>

                {/* Output */}
                <div className="bg-gray-800/20 rounded px-3 py-1.5">
                  <span className="text-gray-500 text-xs">Result: </span>
                  <pre className="text-gray-400 text-xs font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
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
