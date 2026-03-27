"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, ArrowDown } from "lucide-react";
import { MatchStatusBadge } from "../dashboard/MatchStatusBadge";

interface DecomposedTxn {
  txn_ref: string;
  amount: string;
  amount_kobo: number;
  date: string | null;
  response_code: string;
  invoice_match: "matched" | "orphan";
  matched_invoice: {
    invoice_number: string;
    customer_name: string;
    amount: string;
  } | null;
}

interface DecomposeResult {
  batch_id: string;
  bank_transaction?: {
    narration: string;
    amount: string;
    date: string | null;
  };
  transaction_count: number;
  total_isw_amount: string;
  bank_amount: string;
  difference: string;
  is_balanced: boolean;
  match_quality: string;
  matched_count: number;
  orphan_count: number;
  transactions: DecomposedTxn[];
}

export function SettlementBreakdownPanel({
  batchId,
  bankTransactionId,
}: {
  batchId?: string;
  bankTransactionId?: string;
}) {
  const [result, setResult] = useState<DecomposeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const decompose = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = bankTransactionId
        ? { bank_transaction_id: bankTransactionId }
        : { batch_id: batchId };

      const res = await fetch("/api/reconcile/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
        setExpanded(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decomposition failed");
    }
    setLoading(false);
  };

  const matchedRatio = result
    ? result.transaction_count > 0
      ? (result.matched_count / result.transaction_count) * 100
      : 0
    : 0;

  return (
    <div className="space-y-4">
      {/* Settlement header card */}
      <div className="bg-sg-bg-card border border-sg-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sg-text-tertiary text-[11px] font-medium uppercase tracking-wider">
            Bank Settlement
          </span>
          {result && (
            <span className={`text-[11px] font-mono font-medium ${result.is_balanced ? "text-sg-matched" : "text-sg-mismatch"}`}>
              {result.match_quality === "exact" ? "EXACT MATCH" : result.match_quality === "within_tolerance" ? "WITHIN TOLERANCE" : "MISMATCH"}
            </span>
          )}
        </div>

        {result?.bank_transaction ? (
          <>
            <p className="text-[28px] font-mono font-bold text-sg-text leading-none">{result.bank_amount}</p>
            <p className="text-sg-text-tertiary text-[11px] font-mono mt-1">{result.bank_transaction.narration}</p>
          </>
        ) : (
          <>
            <p className="text-lg font-mono font-bold text-sg-text">{batchId || "Settlement"}</p>
            <p className="text-sg-text-tertiary text-[13px] mt-1">Click decompose to break into individual transactions</p>
          </>
        )}

        {/* Progress bar */}
        {result && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-sg-text-tertiary">
                <span className="text-sg-text font-mono font-medium">{result.matched_count}</span>/{result.transaction_count} matched
              </span>
              <span className="text-[11px] font-mono text-sg-text-tertiary">{matchedRatio.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-sg-bg-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-sg-matched rounded-full animate-sg-bar-fill"
                style={{ width: `${matchedRatio}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={decompose}
          disabled={loading}
          className="mt-4 w-full px-4 py-2 bg-sg-accent/10 border border-sg-accent/30 hover:bg-sg-accent/20 rounded-md text-[13px] font-medium text-sg-accent transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <><RefreshCw className="w-3.5 h-3.5 animate-sg-spin" />Decomposing...</>
          ) : (
            <><ArrowDown className="w-3.5 h-3.5" />{result ? "Re-decompose" : "Decompose Settlement"}</>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-sg-mismatch/5 border border-sg-mismatch/20 rounded-lg p-3">
          <p className="text-sg-mismatch text-sm">{error}</p>
        </div>
      )}

      {/* Decomposed transaction tiles */}
      {result && expanded && (
        <div className="space-y-3">
          {/* Tile grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {result.transactions.map((txn, i) => (
              <div
                key={i}
                className={`bg-sg-bg-card border rounded-lg p-3 animate-sg-tile-reveal border-l-2 ${
                  txn.invoice_match === "orphan"
                    ? "border-sg-border border-l-sg-mismatch sg-glow-mismatch"
                    : "border-sg-border border-l-sg-matched"
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-mono font-bold text-sg-text tabular-nums">{txn.amount}</span>
                  <MatchStatusBadge status={txn.invoice_match === "matched" ? "full_match" : "orphan_isw"} />
                </div>
                <p className="text-[10px] font-mono text-sg-text-tertiary truncate">{txn.txn_ref}</p>
                {txn.matched_invoice && (
                  <p className="text-[10px] text-sg-text-secondary mt-1 truncate">
                    {txn.matched_invoice.invoice_number}
                  </p>
                )}
                {txn.invoice_match === "orphan" && (
                  <p className="text-[10px] text-sg-mismatch mt-1">No invoice found</p>
                )}
              </div>
            ))}
          </div>

          {/* Balance summary */}
          <div className={`rounded-lg p-4 flex items-center gap-3 ${
            result.is_balanced
              ? "bg-sg-matched/5 border border-sg-matched/20"
              : "bg-sg-orphan/5 border border-sg-orphan/20"
          }`}>
            {result.is_balanced ? (
              <CheckCircle2 className="w-5 h-5 text-sg-matched shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-sg-orphan shrink-0" />
            )}
            <div>
              <p className={`text-sm font-mono font-medium ${result.is_balanced ? "text-sg-matched" : "text-sg-orphan"}`}>
                ISW: {result.total_isw_amount} | Bank: {result.bank_amount}
              </p>
              {!result.is_balanced && (
                <p className="text-[11px] text-sg-text-tertiary mt-0.5">
                  Difference of {result.difference} &mdash; AI investigation recommended
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
