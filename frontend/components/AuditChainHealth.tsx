"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, ShieldAlert, ShieldCheck, RefreshCw, Hash } from "lucide-react";
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
    try {
      const res = await fetch("/api/audit/verify", { method: "POST" });
      const data = await res.json();
      setVerifyResult(data);
      if (data.valid) {
        toast.success(`Chain integrity verified: ${data.totalEntries} entries, all valid`);
      } else {
        toast.error(`Chain BROKEN at entry #${data.brokenAt}: ${data.details}`);
      }
    } catch { toast.error("Verification failed"); }
    setVerifying(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gray-500" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tamper-Evident Audit Chain</h1>
          <p className="text-gray-400 text-sm mt-1">SHA-256 hash-linked chain of all reconciliation events</p>
        </div>
        <button onClick={verify} disabled={verifying} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
          <Shield className={`w-4 h-4 ${verifying ? "animate-pulse" : ""}`} />
          {verifying ? "Verifying..." : "Verify Chain Integrity"}
        </button>
      </div>

      {/* Verify result banner */}
      {verifyResult && (
        <div className={`rounded-xl p-5 flex items-center gap-4 ${verifyResult.valid ? "bg-emerald-900/20 border border-emerald-800/40" : "bg-red-900/20 border border-red-800/40"}`}>
          {verifyResult.valid ? (
            <>
              <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-400">Chain Integrity Verified</p>
                <p className="text-gray-400 text-sm">{verifyResult.totalEntries} entries checked — all hashes valid, no tampering detected.</p>
              </div>
            </>
          ) : (
            <>
              <ShieldAlert className="w-8 h-8 text-red-400 shrink-0" />
              <div>
                <p className="font-semibold text-red-400">Chain Integrity BROKEN</p>
                <p className="text-gray-300 text-sm">Tamper detected at entry #{verifyResult.brokenAt}</p>
                <p className="text-gray-400 text-xs mt-0.5">{verifyResult.details}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Chain entries */}
      <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Audit Entries ({entries.length})</h2>
        {entries.length === 0 ? (
          <p className="text-gray-500 text-sm">No audit entries yet. Run some operations to generate entries.</p>
        ) : (
          <div className="space-y-3">
            {entries.map((e, i) => (
              <div key={e.id} className={`bg-gray-800/30 rounded-lg p-4 ${verifyResult && !verifyResult.valid && verifyResult.brokenAt === e.id ? "ring-2 ring-red-500" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500">#{e.id}</span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300">{e.event_type}</span>
                      <span className="text-xs text-gray-500">{e.entity_type}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <Hash className="w-3 h-3" />
                      <span className="font-mono">{e.hash.substring(0, 16)}...</span>
                      {i < entries.length - 1 && (
                        <span className="text-gray-600 ml-2">prev: {e.prev_hash.substring(0, 12)}...</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">{e.actor}</p>
                    <p className="text-xs text-gray-600">{new Date(e.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
