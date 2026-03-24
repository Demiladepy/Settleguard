"use client";

import { useState } from "react";
import { Shield, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";

interface VerifyResult {
  valid: boolean;
  brokenAt: number | null;
  totalEntries: number;
  details?: string;
}

export function IntegrityIndicator() {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/audit/verify", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ valid: false, brokenAt: null, totalEntries: 0, details: "Verification request failed" });
    }
    setVerifying(false);
  };

  if (!result) {
    return (
      <button
        onClick={verify}
        disabled={verifying}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
      >
        {verifying ? (
          <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
        ) : (
          <Shield className="w-4 h-4 text-gray-400" />
        )}
        {verifying ? "Verifying..." : "Verify Chain"}
      </button>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
        result.valid
          ? "bg-emerald-900/20 border border-emerald-800/40 hover:bg-emerald-900/30"
          : "bg-red-900/20 border border-red-800/40 hover:bg-red-900/30"
      }`}
      onClick={verify}
      title="Click to re-verify"
    >
      {verifying ? (
        <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
      ) : result.valid ? (
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
      ) : (
        <ShieldAlert className="w-5 h-5 text-red-400" />
      )}

      <div>
        {result.valid ? (
          <>
            <p className="text-sm font-medium text-emerald-400">Chain Intact</p>
            <p className="text-xs text-gray-400">{result.totalEntries} entries verified</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-red-400">INTEGRITY BREACH</p>
            <p className="text-xs text-gray-300">
              {result.brokenAt ? `Broken at entry #${result.brokenAt}` : result.details}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
