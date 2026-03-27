"use client";

import { useState } from "react";
import { RefreshCw, Database, Landmark } from "lucide-react";
import { toast } from "sonner";
import { StatsCards } from "./dashboard/StatsCards";
import { TransactionFeed } from "./dashboard/TransactionFeed";
import { IntegrityIndicator } from "./audit/IntegrityIndicator";

export function Dashboard() {
  const [reconciling, setReconciling] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const res = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_type: "manual" }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(
          `Reconciled: ${data.matched} matched, ${data.mismatched} mismatched, ${data.unmatched} unmatched`
        );
      }
    } catch {
      toast.error("Reconciliation failed");
    }
    setReconciling(false);
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(
          `Seeded: ${data.seeded.invoices} invoices, ${data.seeded.isw_transactions} ISW txns, ${data.seeded.bank_transactions} bank txns`
        );
      }
    } catch {
      toast.error("Seed failed");
    }
    setSeeding(false);
  };

  const handleSyncBank = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sources/sync-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else if (data.source === "seeded_data") {
        toast.info(`Bank: ${data.total} seeded transactions. Link account on /demo for live data.`);
      } else {
        toast.success(`Synced ${data.synced} bank transactions from Mono`);
      }
    } catch {
      toast.error("Bank sync failed");
    }
    setSyncing(false);
  };

  return (
    <div className="space-y-6">
      {/* Command bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-mono font-bold text-sg-text">
            Command Center
          </h1>
          <p className="text-sg-text-tertiary text-[13px] mt-0.5">
            ISW + Bank + Zoho Books &mdash; three-way reconciliation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IntegrityIndicator />
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-3 py-1.5 bg-sg-bg-card border border-sg-border hover:border-sg-border-hover rounded-md text-[13px] font-medium text-sg-text-secondary hover:text-sg-text transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Database className="w-3.5 h-3.5" />
            {seeding ? "Seeding..." : "Seed Data"}
          </button>
          <button
            onClick={handleSyncBank}
            disabled={syncing}
            className="px-3 py-1.5 bg-sg-bg-card border border-sg-border hover:border-sg-border-hover rounded-md text-[13px] font-medium text-sg-text-secondary hover:text-sg-text transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Landmark className="w-3.5 h-3.5" />
            {syncing ? "Syncing..." : "Sync Bank"}
          </button>
          <button
            onClick={handleReconcile}
            disabled={reconciling}
            className="px-3 py-1.5 bg-sg-accent/10 border border-sg-accent/30 hover:bg-sg-accent/20 rounded-md text-[13px] font-medium text-sg-accent transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reconciling ? "animate-sg-spin" : ""}`} />
            {reconciling ? "Running..." : "Reconcile"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsCards />

      {/* Transaction Feed */}
      <TransactionFeed />
    </div>
  );
}
