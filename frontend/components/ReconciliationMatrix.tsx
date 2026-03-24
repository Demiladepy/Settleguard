"use client";

import { useEffect, useState, useCallback } from "react";
import { SettlementBreakdownPanel } from "./settlement/SettlementBreakdown";
import { MatchStatusBadge } from "./dashboard/MatchStatusBadge";
import { RefreshCw, Building2, Landmark, FileText, Link2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface BankTxn {
  id: string;
  narration: string;
  amount_kobo: number;
  transaction_type: string;
  transaction_date: string | null;
}

interface ErpInv {
  id: string;
  invoice_number: string | null;
  customer_name: string | null;
  amount_kobo: number;
  status: string;
}

interface Match {
  id: string;
  match_status: string;
  isw_amount: number | null;
  bank_amount: number | null;
  erp_amount: number | null;
  confidence_score: number | null;
  isw_transaction_id: string | null;
  bank_transaction_id: string | null;
  erp_invoice_id: string | null;
}

function koboToNaira(k: number) {
  return `₦${(k / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

export function ReconciliationMatrix() {
  const [bankTxns, setBankTxns] = useState<BankTxn[]>([]);
  const [erpInvs, setErpInvs] = useState<ErpInv[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBankTxn, setSelectedBankTxn] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [bRes, eRes, mRes] = await Promise.all([
      supabase.from("bank_transactions").select("*").eq("transaction_type", "credit").order("transaction_date", { ascending: false }),
      supabase.from("erp_invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("reconciliation_matches").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setBankTxns(bRes.data || []);
    setErpInvs(eRes.data || []);
    setMatches(mRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();

    // Realtime refresh
    const channel = supabase
      .channel("recon-matrix")
      .on("postgres_changes", { event: "*", schema: "public", table: "reconciliation_matches" }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  // Identify settlement deposits (ISW narrations with BATCH)
  const settlementDeposits = bankTxns.filter((t) =>
    t.narration.includes("ISW") || t.narration.includes("BATCH")
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Three-Source Reconciliation</h1>
          <p className="text-gray-400 text-sm mt-1">
            ISW + Bank + ERP with match status tracking
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Three-column matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ISW Column — shown via matches */}
        <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold">Interswitch (Gateway)</h2>
          </div>
          <p className="text-gray-500 text-xs mb-3">What customers paid</p>
          {matches.length === 0 ? (
            <p className="text-gray-500 text-sm">Run reconciliation to see matches.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {matches.map((m) => (
                <div key={m.id} className="bg-gray-800/40 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <MatchStatusBadge status={m.match_status} />
                    <span className="text-white font-mono text-xs">
                      {m.isw_amount ? koboToNaira(m.isw_amount) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {m.confidence_score != null && (
                      <span>{(m.confidence_score * 100).toFixed(0)}% conf</span>
                    )}
                    <Link2 className="w-3 h-3" />
                    <span>
                      {[m.isw_transaction_id ? "ISW" : null, m.bank_transaction_id ? "Bank" : null, m.erp_invoice_id ? "ERP" : null]
                        .filter(Boolean)
                        .join(" + ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bank Column */}
        <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Landmark className="w-5 h-5 text-emerald-400" />
            <h2 className="font-semibold">Bank Account (Mono)</h2>
          </div>
          <p className="text-gray-500 text-xs mb-3">What actually arrived</p>
          {bankTxns.length === 0 ? (
            <p className="text-gray-500 text-sm">No bank transactions yet.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {bankTxns.map((t) => (
                <div
                  key={t.id}
                  className={`bg-gray-800/40 rounded-lg p-3 text-sm cursor-pointer transition-colors ${
                    selectedBankTxn === t.id ? "ring-2 ring-emerald-500" : "hover:bg-gray-800/60"
                  }`}
                  onClick={() =>
                    setSelectedBankTxn(selectedBankTxn === t.id ? null : t.id)
                  }
                >
                  <div className="flex justify-between">
                    <span className="text-emerald-400 font-medium">
                      +{koboToNaira(t.amount_kobo)}
                    </span>
                    {t.narration.includes("BATCH") && (
                      <span className="text-xs bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded">
                        Settlement
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs mt-1 truncate">{t.narration}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ERP Column */}
        <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-purple-400" />
            <h2 className="font-semibold">Zoho Books (ERP)</h2>
          </div>
          <p className="text-gray-500 text-xs mb-3">What the books expect</p>
          {erpInvs.length === 0 ? (
            <p className="text-gray-500 text-sm">No invoices yet.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {erpInvs.map((inv) => (
                <div key={inv.id} className="bg-gray-800/40 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-purple-400 font-medium">
                      {inv.invoice_number}
                    </span>
                    <span className="text-white font-mono text-xs">
                      {koboToNaira(inv.amount_kobo)}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-400 text-xs">{inv.customer_name}</span>
                    <MatchStatusBadge status={inv.status === "paid" ? "success" : inv.status === "overdue" ? "failed" : "pending"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settlement Breakdown */}
      {(settlementDeposits.length > 0 || selectedBankTxn) && (
        <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Settlement Decomposition</h2>
          <p className="text-gray-400 text-sm mb-4">
            {selectedBankTxn
              ? "Decomposing selected bank transaction into individual ISW payments."
              : "Click a bank settlement above, or select one below."}
          </p>

          {!selectedBankTxn && (
            <div className="flex gap-2 flex-wrap mb-4">
              {settlementDeposits.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedBankTxn(t.id)}
                  className="px-3 py-1.5 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-lg text-sm transition-colors"
                >
                  {koboToNaira(t.amount_kobo)} — {t.narration.substring(0, 30)}...
                </button>
              ))}
            </div>
          )}

          {selectedBankTxn && (
            <SettlementBreakdownPanel bankTransactionId={selectedBankTxn} />
          )}
        </div>
      )}
    </div>
  );
}
