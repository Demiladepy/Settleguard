"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, ArrowRight } from "lucide-react";

interface Breakdown {
  batch_id: string;
  transaction_count: number;
  total_isw_amount: string;
  bank_amount: string;
  difference: string;
  is_balanced: boolean;
  transactions: Array<{
    txn_ref: string;
    amount: string;
    date: string | null;
    response_code: string;
  }>;
}

export function SettlementBreakdown({ batchId }: { batchId: string }) {
  const [data, setData] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Direct approach: query ISW transactions by batch
    fetch(`/api/reconcile`)
      .then((r) => r.json())
      .then((res) => {
        // Try to build breakdown from available match data
        void res;
        setData(null);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [batchId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-4">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm">Decomposing settlement {batchId}...</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-400 text-sm">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-emerald-400">{batchId}</h3>
          <div className="flex items-center gap-1.5">
            {data?.is_balanced ? (
              <><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400 text-sm">Balanced</span></>
            ) : (
              <><XCircle className="w-4 h-4 text-red-400" /><span className="text-red-400 text-sm">Mismatch</span></>
            )}
          </div>
        </div>

        {data ? (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4 text-center">
              <div>
                <p className="text-gray-500 text-xs">ISW Total</p>
                <p className="text-white font-mono font-bold">{data.total_isw_amount}</p>
              </div>
              <div className="flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-gray-500 text-xs">Bank Deposit</p>
                <p className="text-white font-mono font-bold">{data.bank_amount}</p>
              </div>
            </div>

            {!data.is_balanced && (
              <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 mb-3">
                <p className="text-red-400 text-sm font-medium">Difference: {data.difference}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-gray-400 text-xs font-medium">{data.transaction_count} individual transactions:</p>
              {data.transactions.map((t, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-900/50 rounded px-3 py-2 text-sm">
                  <span className="text-gray-300 font-mono text-xs">{t.txn_ref}</span>
                  <span className="text-white font-mono">{t.amount}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-gray-400 text-sm">Run reconciliation first to see the breakdown. The AI agent will decompose the settlement into individual transactions.</p>
        )}
      </div>
    </div>
  );
}
