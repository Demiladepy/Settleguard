"use client";

import { useState } from "react";
import { AlertTriangle, Bot, Search, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { InvestigationTimeline } from "./InvestigationTimeline";
import { MatchStatusBadge } from "../dashboard/MatchStatusBadge";
import { toast } from "sonner";

interface Dispute {
  id: string;
  reason: string;
  priority: string;
  ai_recommendation: string | null;
  ai_confidence: number | null;
  ai_investigation: { tool_calls?: ToolCall[]; evidence?: string[] } | null;
  resolution: string | null;
  resolved_by: string | null;
  created_at: string;
}

interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  output: string;
}

interface InvestigationResult {
  recommendation: string;
  confidence: number;
  summary: string;
  evidence: string[];
  tool_calls: ToolCall[];
}

function priorityColor(p: string) {
  switch (p) {
    case "critical": return "bg-red-900/50 text-red-400";
    case "high": return "bg-orange-900/50 text-orange-400";
    case "medium": return "bg-yellow-900/50 text-yellow-400";
    default: return "bg-gray-700 text-gray-300";
  }
}

function recColor(r: string) {
  switch (r) {
    case "refund": return "text-red-400";
    case "reject": return "text-gray-400";
    case "escalate": return "text-orange-400";
    case "wait": return "text-yellow-400";
    case "auto_resolved": return "text-emerald-400";
    default: return "text-gray-500";
  }
}

export function DisputeCard({
  dispute,
  onUpdated,
}: {
  dispute: Dispute;
  onUpdated?: () => void;
}) {
  const [investigating, setInvestigating] = useState(false);
  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);

  const investigate = async () => {
    setInvestigating(true);
    try {
      const res = await fetch("/api/disputes/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispute_id: dispute.id }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setResult(data);
        toast.success(
          `AI: ${data.recommendation} (${(data.confidence * 100).toFixed(0)}%)`
        );
        onUpdated?.();
      }
    } catch {
      toast.error("Investigation failed");
    }
    setInvestigating(false);
  };

  const toolCalls =
    result?.tool_calls ||
    (dispute.ai_investigation?.tool_calls as ToolCall[]) ||
    [];
  const hasInvestigation = result || dispute.ai_recommendation;

  return (
    <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl overflow-hidden">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColor(dispute.priority)}`}>
                {dispute.priority}
              </span>
              {dispute.ai_recommendation && (
                <MatchStatusBadge status={dispute.ai_recommendation} />
              )}
              {(result?.confidence ?? dispute.ai_confidence) != null && (
                <span className={`text-xs font-medium ${recColor(dispute.ai_recommendation || result?.recommendation || "")}`}>
                  {((result?.confidence ?? dispute.ai_confidence ?? 0) * 100).toFixed(0)}% confidence
                </span>
              )}
            </div>
            <p className="text-white text-sm font-medium">{dispute.reason}</p>
            <p className="text-gray-500 text-xs mt-1">
              {new Date(dispute.created_at).toLocaleString()}
            </p>
            {dispute.resolution && (
              <p className="text-emerald-400 text-sm mt-2 flex items-center gap-1">
                Resolved by {dispute.resolved_by}: {dispute.resolution}
              </p>
            )}
          </div>

          <button
            onClick={investigate}
            disabled={investigating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            {investigating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Investigating...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                {hasInvestigation ? "Re-investigate" : "Investigate"}
              </>
            )}
          </button>
        </div>

        {/* AI Result summary */}
        {(result || dispute.ai_recommendation) && (
          <div className="mt-4 bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-sm">AI Agent Investigation</span>
            </div>

            {result?.summary && (
              <p className="text-gray-300 text-sm mb-2">{result.summary}</p>
            )}

            {(result?.evidence || dispute.ai_investigation?.evidence)?.map((e, i) => (
              <p key={i} className="text-gray-400 text-xs ml-4 before:content-['•'] before:mr-2">
                {e as string}
              </p>
            ))}

            {/* Confidence bar */}
            {(result?.confidence ?? dispute.ai_confidence) != null && (
              <div className="mt-3">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (result?.confidence ?? dispute.ai_confidence ?? 0) > 0.8
                        ? "bg-emerald-500"
                        : (result?.confidence ?? dispute.ai_confidence ?? 0) > 0.5
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${((result?.confidence ?? dispute.ai_confidence ?? 0) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Investigation timeline toggle */}
        {toolCalls.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium transition-colors"
            >
              {showTimeline ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              {toolCalls.length} tool calls
            </button>
            {showTimeline && (
              <InvestigationTimeline toolCalls={toolCalls} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
