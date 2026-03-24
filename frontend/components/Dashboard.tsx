"use client";

import { useState } from "react";
import { RefreshCw, Database } from "lucide-react";
import { toast } from "sonner";
import { StatsCards } from "./dashboard/StatsCards";
import { TransactionFeed } from "./dashboard/TransactionFeed";
import { IntegrityIndicator } from "./audit/IntegrityIndicator";

export function Dashboard() {
  const [reconciling, setReconciling] = useState(false);
  const [seeding, setSeeding] = useState(false);

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reconciliation Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Three-way matching: Interswitch + Bank + ERP
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <IntegrityIndicator />
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            {seeding ? "Seeding..." : "Seed Demo Data"}
          </button>
          <button
            onClick={handleReconcile}
            disabled={reconciling}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${reconciling ? "animate-spin" : ""}`} />
            {reconciling ? "Running..." : "Run Reconciliation"}
          </button>
        </div>
      </div>

      {/* Stats with Realtime */}
      <StatsCards />

      {/* Transaction Feed with Realtime */}
      <TransactionFeed />
    </div>
  );
}
