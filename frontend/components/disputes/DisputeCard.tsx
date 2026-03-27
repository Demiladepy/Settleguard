"use client";

import { useState } from "react";
import { Search, RefreshCw, ChevronDown, ChevronRight, Bot } from "lucide-react";
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

function priorityBorder(p: string) {
  switch (p) {
    case "critical": return "border-l-sg-mismatch";
    case "high": return "border-l-sg-orphan";
    case "medium": return "border-l-sg-pending";
    default: return "border-l-sg-text-tertiary";
  }
}

function recommendationBorder(r: string) {
  switch (r) {
    case "refund": return "border-sg-matched/30 bg-sg-matched/5";
    case "escalate": return "border-sg-pending/30 bg-sg-pending/5";
    case "reject": return "border-sg-mismatch/30 bg-sg-mismatch/5";
    default: return "border-sg-border bg-sg-bg-hover/50";
  }
}

function confidenceColor(c: number) {
  if (c > 0.85) return "bg-sg-matched";
  if (c > 0.5) return "bg-sg-pending";
  return "bg-sg-mismatch";
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
  const confidence = result?.confidence ?? dispute.ai_confidence ?? 0;
  const recommendation = result?.recommendation ?? dispute.ai_recommendation ?? "";

  return (
    <div className={`bg-sg-bg-card border border-sg-border border-l-2 ${priorityBorder(dispute.priority)} rounded-lg overflow-hidden`}>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[11px] font-mono font-medium text-sg-text-tertiary uppercase tracking-wider">
                {dispute.priority}
              </span>
              {dispute.ai_recommendation && (
                <MatchStatusBadge status={dispute.ai_recommendation} />
              )}
              {confidence > 0 && (
                <span className="text-[11px] font-mono text-sg-text-tertiary">
                  {(confidence * 100).toFixed(0)}% conf
                </span>
              )}
            </div>
            <p className="text-sg-text text-sm font-medium">{dispute.reason}</p>
            <p className="text-sg-text-tertiary text-[11px] font-mono mt-1">
              {new Date(dispute.created_at).toLocaleString()}
            </p>
            {dispute.resolution && (
              <p className="text-sg-matched text-[13px] mt-2">
                Resolved by {dispute.resolved_by}: {dispute.resolution}
              </p>
            )}
          </div>

          <button
            onClick={investigate}
            disabled={investigating}
            className="px-3 py-1.5 bg-sg-info/10 border border-sg-info/30 hover:bg-sg-info/20 rounded-md text-[13px] font-medium text-sg-info transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {investigating ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-sg-spin" />Investigating...</>
            ) : (
              <><Search className="w-3.5 h-3.5" />{hasInvestigation ? "Re-investigate" : "Investigate"}</>
            )}
          </button>
        </div>

        {/* AI Investigation Result */}
        {hasInvestigation && (
          <div className={`mt-4 rounded-lg p-4 border ${recommendationBorder(recommendation)}`}>
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-sg-accent" />
              <span className="text-[13px] font-semibold text-sg-text">AI Investigation</span>
              {recommendation && (
                <span className="text-[11px] font-mono font-medium text-sg-text-secondary uppercase">
                  {recommendation}
                </span>
              )}
            </div>

            {result?.summary && (
              <p className="text-sg-text-secondary text-[13px] mb-2 italic">
                &ldquo;{result.summary}&rdquo;
              </p>
            )}

            {(result?.evidence || dispute.ai_investigation?.evidence)?.map((e, i) => (
              <p key={i} className="text-sg-text-tertiary text-[11px] ml-3 before:content-['▸'] before:mr-2 before:text-sg-accent">
                {e as string}
              </p>
            ))}

            {/* Confidence bar — horizontal, not circular */}
            {confidence > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-[11px] font-mono text-sg-text-tertiary shrink-0">Confidence:</span>
                <div className="flex-1 h-2 bg-sg-bg-hover rounded-sm overflow-hidden">
                  <div
                    className={`h-full rounded-sm transition-all duration-700 ${confidenceColor(confidence)}`}
                    style={{ width: `${confidence * 100}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono font-medium text-sg-text tabular-nums">
                  {(confidence * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Timeline toggle */}
        {toolCalls.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="flex items-center gap-1.5 text-sg-text-tertiary hover:text-sg-text text-[11px] font-mono font-medium transition-colors"
            >
              {showTimeline ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              {toolCalls.length} tool calls
            </button>
            {showTimeline && <InvestigationTimeline toolCalls={toolCalls} />}
          </div>
        )}
      </div>
    </div>
  );
}
