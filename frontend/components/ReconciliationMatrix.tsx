"use client";

import { useEffect, useState, useCallback } from "react";
import { SettlementBreakdownPanel } from "./settlement/SettlementBreakdown";
import { MatchStatusBadge } from "./dashboard/MatchStatusBadge";
import { RefreshCw, Lock, ShieldCheck } from "lucide-react";
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
  match_details: {
    privacy?: {
      isw_commitment?: string;
      erp_commitment?: string;
      verified?: boolean;
    };
    [key: string]: unknown;
  } | null;
}

function koboToNaira(k: number) {
  return `₦${(k / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

function confidenceColor(score: number) {
  if (score > 0.85) return "text-sg-matched";
  if (score > 0.5) return "text-sg-pending";
  return "text-sg-mismatch";
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
    const channel = supabase
      .channel("recon-matrix")
      .on("postgres_changes", { event: "*", schema: "public", table: "reconciliation_matches" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const settlementDeposits = bankTxns.filter((t) =>
    t.narration.includes("ISW") || t.narration.includes("BATCH")
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-mono font-bold text-sg-text">Reconciliation Matrix</h1>
          <p className="text-sg-text-tertiary text-[13px] mt-0.5">
            ISW Gateway + Bank (Mono) + Zoho Books ERP
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="p-2 hover:bg-sg-bg-hover rounded-md transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-sg-text-secondary ${loading ? "animate-sg-spin" : ""}`} />
        </button>
      </div>

      {/* Three-column matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ISW Column — shown via matches */}
        <div className="bg-sg-bg-card border border-sg-border rounded-lg">
          <div className="px-4 py-3 border-b border-sg-border">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-sg-text">ISW Transactions</h2>
              <span className="text-[11px] font-mono text-sg-text-tertiary">{matches.length} matches</span>
            </div>
            <p className="text-sg-text-tertiary text-[11px] mt-0.5">What customers paid</p>
          </div>
          {matches.length === 0 ? (
            <p className="text-sg-text-tertiary text-sm py-6 text-center">Run reconciliation to see matches.</p>
          ) : (
            <div className="max-h-[500px] overflow-y-auto sg-scrollbar">
              {matches.map((m) => {
                const privacy = m.match_details?.privacy;
                return (
                  <div key={m.id} className="px-4 py-2.5 border-b border-sg-border/50 hover:bg-sg-bg-hover/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <MatchStatusBadge status={m.match_status} />
                      <span className="text-sg-text font-mono text-[13px] font-bold tabular-nums">
                        {m.isw_amount ? koboToNaira(m.isw_amount) : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-sg-text-tertiary">
                      {m.confidence_score != null && (
                        <span className={`font-mono font-medium ${confidenceColor(m.confidence_score)}`}>
                          {(m.confidence_score * 100).toFixed(0)}%
                        </span>
                      )}
                      <span className="font-mono">
                        {[m.isw_transaction_id ? "ISW" : null, m.bank_transaction_id ? "Bank" : null, m.erp_invoice_id ? "ERP" : null]
                          .filter(Boolean)
                          .join(" + ")}
                      </span>
                      {privacy?.verified && (
                        <span className="flex items-center gap-0.5 text-sg-matched">
                          <Lock className="w-3 h-3" />
                          <span className="font-mono">ZK</span>
                        </span>
                      )}
                    </div>
                    {privacy?.isw_commitment && (
                      <div className="mt-1.5 bg-sg-bg/50 rounded-sm px-2 py-1">
                        <div className="flex items-center gap-1 text-[10px] text-sg-text-tertiary font-mono">
                          <ShieldCheck className="w-3 h-3 text-sg-matched/60" />
                          <span className="truncate">
                            {privacy.isw_commitment.substring(0, 16)}...={privacy.verified ? "match" : "MISMATCH"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bank Column */}
        <div className="bg-sg-bg-card border border-sg-border rounded-lg">
          <div className="px-4 py-3 border-b border-sg-border">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-sg-text">Bank Account (Mono)</h2>
              <span className="text-[11px] font-mono text-sg-text-tertiary">{bankTxns.length} credits</span>
            </div>
            <p className="text-sg-text-tertiary text-[11px] mt-0.5">What actually arrived</p>
          </div>
          {bankTxns.length === 0 ? (
            <p className="text-sg-text-tertiary text-sm py-6 text-center">No bank transactions yet.</p>
          ) : (
            <div className="max-h-[500px] overflow-y-auto sg-scrollbar">
              {bankTxns.map((t) => (
                <div
                  key={t.id}
                  className={`px-4 py-2.5 border-b border-sg-border/50 cursor-pointer transition-colors ${
                    selectedBankTxn === t.id
                      ? "bg-sg-accent/5 border-l-2 border-l-sg-accent"
                      : "hover:bg-sg-bg-hover/50 border-l-2 border-l-transparent"
                  }`}
                  onClick={() => setSelectedBankTxn(selectedBankTxn === t.id ? null : t.id)}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sg-matched font-mono text-[13px] font-bold tabular-nums">
                      +{koboToNaira(t.amount_kobo)}
                    </span>
                    {t.narration.includes("BATCH") && (
                      <span className="text-[10px] font-mono font-medium text-sg-info bg-sg-info/10 px-1.5 py-0.5 rounded-sm">
                        SETTLEMENT
                      </span>
                    )}
                  </div>
                  <p className="text-sg-text-tertiary text-[11px] font-mono mt-0.5 truncate">{t.narration}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ERP Column */}
        <div className="bg-sg-bg-card border border-sg-border rounded-lg">
          <div className="px-4 py-3 border-b border-sg-border">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-sg-text">Zoho Books (ERP)</h2>
              <span className="text-[11px] font-mono text-sg-text-tertiary">{erpInvs.length} invoices</span>
            </div>
            <p className="text-sg-text-tertiary text-[11px] mt-0.5">What the books expect</p>
          </div>
          {erpInvs.length === 0 ? (
            <p className="text-sg-text-tertiary text-sm py-6 text-center">No invoices yet.</p>
          ) : (
            <div className="max-h-[500px] overflow-y-auto sg-scrollbar">
              {erpInvs.map((inv) => (
                <div key={inv.id} className="px-4 py-2.5 border-b border-sg-border/50 hover:bg-sg-bg-hover/50 transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="text-sg-text font-mono text-[13px]">
                      {inv.invoice_number}
                    </span>
                    <span className="text-sg-text font-mono text-[13px] font-bold tabular-nums">
                      {koboToNaira(inv.amount_kobo)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-sg-text-tertiary text-[11px]">{inv.customer_name}</span>
                    <MatchStatusBadge status={inv.status === "paid" ? "success" : inv.status === "overdue" ? "failed" : "pending"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Privacy Verification Summary */}
      {matches.some((m) => m.match_details?.privacy?.verified) && (
        <div className="bg-sg-matched/5 border border-sg-matched/20 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <Lock className="w-5 h-5 text-sg-matched" />
            <div>
              <h2 className="font-semibold text-sm text-sg-matched">Privacy-Preserving Verification</h2>
              <p className="text-sg-text-tertiary text-[11px]">
                SHA-256 commitment scheme — amounts verified without exposing raw data
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-sg-bg-card rounded-lg p-3 text-center">
              <p className="text-2xl font-mono font-bold text-sg-matched">
                {matches.filter((m) => m.match_details?.privacy?.verified).length}
              </p>
              <p className="text-[11px] text-sg-text-tertiary">Verified</p>
            </div>
            <div className="bg-sg-bg-card rounded-lg p-3 text-center">
              <p className="text-2xl font-mono font-bold text-sg-text">
                {matches.filter((m) => m.match_details?.privacy).length}
              </p>
              <p className="text-[11px] text-sg-text-tertiary">Total Commitments</p>
            </div>
            <div className="bg-sg-bg-card rounded-lg p-3 text-center">
              <p className="text-lg font-mono font-bold text-sg-info">SHA-256</p>
              <p className="text-[11px] text-sg-text-tertiary">Scheme</p>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Decomposition */}
      {(settlementDeposits.length > 0 || selectedBankTxn) && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-sg-accent rounded-full" />
            <h2 className="text-sm font-mono font-semibold text-sg-text uppercase tracking-wider">
              Settlement Decomposition
            </h2>
          </div>

          {!selectedBankTxn && (
            <div className="flex gap-2 flex-wrap mb-4">
              {settlementDeposits.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedBankTxn(t.id)}
                  className="px-3 py-1.5 bg-sg-bg-card border border-sg-border hover:border-sg-border-hover rounded-md text-[13px] font-mono text-sg-text-secondary hover:text-sg-text transition-colors"
                >
                  {koboToNaira(t.amount_kobo)} &mdash; {t.narration.substring(0, 30)}...
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
