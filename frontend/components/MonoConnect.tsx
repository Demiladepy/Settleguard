"use client";

import { useState, useCallback } from "react";
import { Landmark, RefreshCw, CheckCircle2, Link2 } from "lucide-react";
import { toast } from "sonner";
import Script from "next/script";

declare global {
  interface Window {
    Connect?: new (config: Record<string, unknown>) => { setup: () => void; open: () => void };
  }
}

interface BankAccount {
  account_id: string;
  institution: string | null;
  transactions_synced: number;
}

export function MonoConnect() {
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const handleConnect = useCallback(() => {
    const publicKey = process.env.NEXT_PUBLIC_MONO_PUBLIC_KEY;
    if (!publicKey) {
      toast.error("Mono public key not configured");
      return;
    }

    if (!window.Connect) {
      toast.error("Mono Connect script not loaded yet");
      return;
    }

    setConnecting(true);

    const connect = new window.Connect({
      key: publicKey,
      onSuccess: async (data: { code: string }) => {
        setConnecting(false);
        setSyncing(true);
        toast.info("Bank linked! Syncing transactions...");

        try {
          const res = await fetch("/api/mono/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: data.code }),
          });
          const result = await res.json();

          if (result.success) {
            setAccount({
              account_id: result.account_id,
              institution: result.institution,
              transactions_synced: result.transactions_synced,
            });
            toast.success(
              `${result.institution || "Bank"} connected — ${result.transactions_synced} transactions synced`
            );
          } else {
            toast.error(result.error || "Failed to sync bank data");
          }
        } catch {
          toast.error("Failed to process bank connection");
        }
        setSyncing(false);
      },
      onClose: () => {
        setConnecting(false);
      },
      onEvent: (eventName: string) => {
        if (eventName === "OPENED") {
          setConnecting(true);
        }
      },
    });

    connect.setup();
    connect.open();
  }, []);

  const handleResync = async () => {
    if (!account) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/sources/sync-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: account.account_id }),
      });
      const data = await res.json();
      if (data.synced !== undefined) {
        setAccount((prev) => prev ? { ...prev, transactions_synced: data.synced } : prev);
        toast.success(`Synced ${data.synced} bank transactions`);
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch {
      toast.error("Failed to sync");
    }
    setSyncing(false);
  };

  return (
    <div className="bg-sg-bg-card border border-sg-border rounded-lg p-4">
      <Script
        src="https://connect.mono.co/connect.js"
        strategy="lazyOnload"
        onLoad={() => setScriptLoaded(true)}
      />

      <div className="flex items-center gap-2 mb-3">
        <Landmark className="w-4 h-4 text-sg-accent" />
        <h2 className="text-[11px] font-mono font-semibold text-sg-text uppercase tracking-wider">
          Bank Account (Mono)
        </h2>
      </div>

      {account ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sg-matched" />
            <span className="text-sg-text text-[13px] font-medium">
              {account.institution || "Bank Account"}
            </span>
            <span className="text-sg-text-tertiary text-[11px] font-mono">
              {account.transactions_synced} txns
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResync}
              disabled={syncing}
              className="px-3 py-1.5 bg-sg-bg-hover border border-sg-border hover:border-sg-border-hover rounded-md text-[13px] font-medium text-sg-text-secondary hover:text-sg-text transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-sg-spin" : ""}`} />
              {syncing ? "Syncing..." : "Re-sync"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sg-text-tertiary text-[13px]">
            Link a bank account to pull real transaction data for reconciliation.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting || syncing || !scriptLoaded}
            className="px-4 py-2 bg-sg-accent/10 border border-sg-accent/30 hover:bg-sg-accent/20 rounded-md text-[13px] font-medium text-sg-accent transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {connecting ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-sg-spin" />Connecting...</>
            ) : syncing ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-sg-spin" />Syncing transactions...</>
            ) : (
              <><Link2 className="w-3.5 h-3.5" />Link Bank Account</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
