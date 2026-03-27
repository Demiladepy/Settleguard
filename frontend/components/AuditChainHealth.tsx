"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface AuditEntry {
  id: number;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
  created_at: string;
}

interface VerifyResult {
  valid: boolean;
  brokenAt: number | null;
  totalEntries: number;
  details?: string;
}

export function AuditChainHealth() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifiedUpTo, setVerifiedUpTo] = useState(-1);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/audit");
      const data = await res.json();
      setEntries(data.entries || []);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const verify = async () => {
    setVerifying(true);
    setVerifiedUpTo(-1);
    setVerifyResult(null);

    try {
      const res = await fetch("/api/audit/verify", { method: "POST" });
      const data = await res.json();

      // Animate chain verification — pulse through each block
      const total = Math.min(entries.length, 20);
      for (let i = 0; i < total; i++) {
        await new Promise((r) => setTimeout(r, 80));
        setVerifiedUpTo(i);
        if (!data.valid && data.brokenAt === entries[i]?.id) break;
      }

      setVerifyResult(data);
      if (data.valid) {
        toast.success(`Chain intact: ${data.totalEntries} entries verified`);
      } else {
        toast.error(`Chain BROKEN at entry #${data.brokenAt}`);
      }
    } catch {
      toast.error("Verification failed");
    }
    setVerifying(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-5 h-5 animate-sg-spin text-sg-text-tertiary" />
      </div>
    );
  }

  const isBroken = verifyResult && !verifyResult.valid;
  const isVerified = verifyResult?.valid;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-mono font-bold text-sg-text">Audit Chain</h1>
          <p className="text-sg-text-tertiary text-[13px] mt-0.5">
            SHA-256 hash-linked chain &mdash; {entries.length} entries
          </p>
        </div>
        <button
          onClick={verify}
          disabled={verifying}
          className="px-3 py-1.5 bg-sg-accent/10 border border-sg-accent/30 hover:bg-sg-accent/20 rounded-md text-[13px] font-medium text-sg-accent transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <Shield className={`w-3.5 h-3.5 ${verifying ? "animate-sg-spin" : ""}`} />
          {verifying ? "Verifying..." : "Verify Integrity"}
        </button>
      </div>

      {/* Verify result banner */}
      {verifyResult && (
        <div className={`rounded-lg p-4 flex items-center gap-3 ${
          verifyResult.valid
            ? "bg-sg-matched/5 border border-sg-matched/20"
            : "bg-sg-mismatch/5 border border-sg-mismatch/20"
        }`}>
          {verifyResult.valid ? (
            <ShieldCheck className="w-6 h-6 text-sg-matched shrink-0" />
          ) : (
            <ShieldAlert className="w-6 h-6 text-sg-mismatch shrink-0" />
          )}
          <div>
            <p className={`text-sm font-mono font-semibold ${verifyResult.valid ? "text-sg-matched" : "text-sg-mismatch"}`}>
              {verifyResult.valid ? "CHAIN INTEGRITY VERIFIED" : "CHAIN INTEGRITY BROKEN"}
            </p>
            <p className="text-sg-text-tertiary text-[11px]">
              {verifyResult.valid
                ? `${verifyResult.totalEntries} entries checked — no tampering detected`
                : `Tamper detected at entry #${verifyResult.brokenAt}: ${verifyResult.details}`}
            </p>
          </div>
        </div>
      )}

      {/* Horizontal hash chain visualization */}
      {entries.length > 0 && (
        <div className="bg-sg-bg-card border border-sg-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-sg-accent rounded-full" />
            <h2 className="text-sm font-mono font-semibold text-sg-text uppercase tracking-wider">
              Hash Chain
            </h2>
            {isVerified && (
              <span className="text-[10px] font-mono text-sg-matched ml-auto">INTACT</span>
            )}
          </div>

          <div className="overflow-x-auto sg-scrollbar pb-2">
            <div className="flex items-center gap-0 min-w-max">
              {entries.slice(0, 20).map((e, i) => {
                const isVerifiedBlock = verifiedUpTo >= i;
                const isBrokenBlock = isBroken && verifyResult?.brokenAt === e.id;

                return (
                  <div key={e.id} className="flex items-center">
                    {/* Block */}
                    <div
                      className={`border rounded-lg px-3 py-2 min-w-[90px] text-center transition-all duration-300 ${
                        isBrokenBlock
                          ? "border-sg-mismatch bg-sg-mismatch/10 animate-sg-chain-break"
                          : isVerifiedBlock
                          ? "border-sg-matched/50 bg-sg-matched/5 animate-sg-chain-verify"
                          : "border-sg-border bg-sg-bg"
                      }`}
                      style={isVerifiedBlock && !isBrokenBlock ? { animationDelay: `${i * 80}ms` } : undefined}
                    >
                      <p className="text-[10px] text-sg-text-tertiary font-mono">#{e.id}</p>
                      <p className={`text-[11px] font-mono font-bold ${
                        isBrokenBlock ? "text-sg-mismatch" : isVerifiedBlock ? "text-sg-matched" : "text-sg-text"
                      }`}>
                        {e.hash.substring(0, 6)}
                      </p>
                      <p className="text-[9px] text-sg-text-tertiary font-mono mt-0.5">
                        {e.event_type}
                      </p>
                    </div>

                    {/* Connector arrow */}
                    {i < Math.min(entries.length, 20) - 1 && (
                      <div className="flex items-center px-1">
                        <div className={`w-6 h-px ${
                          isBrokenBlock
                            ? "bg-sg-mismatch"
                            : isVerifiedBlock && verifiedUpTo > i
                            ? "bg-sg-matched/50"
                            : "bg-sg-border"
                        }`} />
                        <div className={`w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[5px] ${
                          isBrokenBlock
                            ? "border-l-sg-mismatch"
                            : isVerifiedBlock && verifiedUpTo > i
                            ? "border-l-sg-matched/50"
                            : "border-l-sg-border"
                        }`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Detailed entries list */}
      <div className="bg-sg-bg-card border border-sg-border rounded-lg">
        <div className="px-4 py-3 border-b border-sg-border">
          <h2 className="text-sm font-semibold text-sg-text">Audit Entries ({entries.length})</h2>
        </div>

        {entries.length === 0 ? (
          <p className="text-sg-text-tertiary text-sm py-6 text-center">
            No audit entries yet. Run operations to generate entries.
          </p>
        ) : (
          <div className="max-h-[500px] overflow-y-auto sg-scrollbar">
            {entries.map((e) => {
              const isBrokenEntry = isBroken && verifyResult?.brokenAt === e.id;
              return (
                <div
                  key={e.id}
                  className={`px-4 py-3 border-b border-sg-border/50 border-l-2 hover:bg-sg-bg-hover/30 transition-colors ${
                    isBrokenEntry ? "border-l-sg-mismatch bg-sg-mismatch/5" : "border-l-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-mono font-medium text-sg-text-tertiary">#{e.id}</span>
                        <span className="text-[11px] font-mono font-medium text-sg-text bg-sg-bg-hover px-1.5 py-0.5 rounded-sm">
                          {e.event_type}
                        </span>
                        <span className="text-[11px] text-sg-text-tertiary">{e.entity_type}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-sg-text-tertiary font-mono mt-1">
                        <span className={isBrokenEntry ? "text-sg-mismatch" : "text-sg-text-secondary"}>
                          {e.hash.substring(0, 16)}...
                        </span>
                        <span className="text-sg-text-tertiary mx-1">&larr;</span>
                        <span>{e.prev_hash.substring(0, 12)}...</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-sg-text-tertiary">{e.actor}</p>
                      <p className="text-[10px] text-sg-text-tertiary font-mono">
                        {new Date(e.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
