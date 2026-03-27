"use client";

import { useState } from "react";
import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";

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
      setResult({ valid: false, brokenAt: null, totalEntries: 0, details: "Request failed" });
    }
    setVerifying(false);
  };

  if (!result) {
    return (
      <button
        onClick={verify}
        disabled={verifying}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-sg-bg-card border border-sg-border hover:border-sg-border-hover rounded-md text-[13px] font-medium text-sg-text-secondary hover:text-sg-text transition-colors disabled:opacity-50"
      >
        {verifying ? (
          <Shield className="w-3.5 h-3.5 animate-sg-spin" />
        ) : (
          <Shield className="w-3.5 h-3.5" />
        )}
        {verifying ? "Verifying..." : "Verify Chain"}
      </button>
    );
  }

  return (
    <button
      onClick={verify}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
        result.valid
          ? "bg-sg-matched/10 border border-sg-matched/30 text-sg-matched hover:bg-sg-matched/20"
          : "bg-sg-mismatch/10 border border-sg-mismatch/30 text-sg-mismatch hover:bg-sg-mismatch/20"
      }`}
      title="Click to re-verify"
    >
      {verifying ? (
        <Shield className="w-3.5 h-3.5 animate-sg-spin" />
      ) : result.valid ? (
        <ShieldCheck className="w-3.5 h-3.5" />
      ) : (
        <ShieldAlert className="w-3.5 h-3.5" />
      )}
      {result.valid
        ? `${result.totalEntries} entries intact`
        : `BROKEN #${result.brokenAt}`}
    </button>
  );
}
