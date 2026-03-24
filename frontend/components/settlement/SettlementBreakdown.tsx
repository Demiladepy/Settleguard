"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, ArrowDown, FileText } from "lucide-react";
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

  return (
    <div className="space-y-4">
      {/* Settlement card */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/60 rounded-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm font-medium">Bank Settlement</span>
          {result && (
            <span className={`text-xs font-medium ${result.is_balanced ? "text-emerald-400" : "text-red-400"}`}>
              {result.match_quality === "exact" ? "Exact Match" : result.match_quality === "within_tolerance" ? "Within Tolerance" : "Mismatch"}
            </span>
          )}
        </div>

        {result?.bank_transaction ? (
          <>
            <p className="text-2xl font-bold text-white mb-1">{result.bank_amount}</p>
            <p className="text-gray-400 text-xs font-mono">{result.bank_transaction.narration}</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-white mb-1">{batchId || "Settlement"}</p>
            <p className="text-gray-500 text-sm">Click decompose to break this deposit into individual transactions</p>
          </>
        )}

        <button
          onClick={decompose}
          disabled={loading}
          className="mt-4 w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <><RefreshCw className="w-4 h-4 animate-spin" />Decomposing...</>
          ) : (
            <><ArrowDown className="w-4 h-4" />{result ? "Re-decompose" : "Decompose Settlement"}</>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Decomposed transactions */}
      {result && expanded && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-400">
                <strong className="text-white">{result.transaction_count}</strong> transactions
              </span>
              <span className="text-emerald-400">
                <strong>{result.matched_count}</strong> matched
              </span>
              {result.orphan_count > 0 && (
                <span className="text-red-400">
                  <strong>{result.orphan_count}</strong> orphan
                </span>
              )}
            </div>
            {!result.is_balanced && (
              <span className="text-orange-400 text-sm font-medium">
                Difference: {result.difference}
              </span>
            )}
          </div>

          {/* Individual transactions */}
          <div className="space-y-2">
            {result.transactions.map((txn, i) => (
              <div
                key={i}
                className={`bg-gray-800/30 border rounded-lg px-4 py-3 transition-colors ${
                  txn.invoice_match === "orphan"
                    ? "border-red-800/40 bg-red-900/10"
                    : "border-gray-800/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-gray-300">{txn.txn_ref}</span>
                    <MatchStatusBadge
                      status={txn.invoice_match === "matched" ? "full_match" : "orphan_isw"}
                    />
                  </div>
                  <span className="text-sm font-mono font-medium text-white">{txn.amount}</span>
                </div>

                {txn.matched_invoice && (
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                    <FileText className="w-3 h-3 text-purple-400" />
                    <span>{txn.matched_invoice.invoice_number}</span>
                    <span className="text-gray-600">|</span>
                    <span>{txn.matched_invoice.customer_name}</span>
                    <span className="text-gray-600">|</span>
                    <span>{txn.matched_invoice.amount}</span>
                  </div>
                )}

                {txn.invoice_match === "orphan" && (
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-red-400">
                    <XCircle className="w-3 h-3" />
                    <span>No matching invoice — dispute auto-created</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Balance summary */}
          <div className={`rounded-lg p-4 ${result.is_balanced ? "bg-emerald-900/20 border border-emerald-800/40" : "bg-orange-900/20 border border-orange-800/40"}`}>
            <div className="flex items-center gap-2">
              {result.is_balanced ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-orange-400" />
              )}
              <div>
                <p className={`text-sm font-medium ${result.is_balanced ? "text-emerald-400" : "text-orange-400"}`}>
                  ISW Total: {result.total_isw_amount} | Bank: {result.bank_amount}
                </p>
                {!result.is_balanced && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Difference of {result.difference} detected. AI investigation recommended.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
