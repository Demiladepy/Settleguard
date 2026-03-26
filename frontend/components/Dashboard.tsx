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
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900/40 via-gray-900 to-blue-900/30 border border-gray-800/60 p-6 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_50%)]" />
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                SettleGuard
              </h1>
              <p className="text-emerald-400/80 text-sm font-medium mt-1">
                Multi-Source AI Reconciliation Engine
              </p>
              <p className="text-gray-400 text-sm mt-2 max-w-lg leading-relaxed">
                Three-way automated matching across Interswitch, bank accounts, and Zoho Books.
                AI-powered dispute resolution. Tamper-evident audit chain.
              </p>
              <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  Interswitch Gateway
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Bank via Mono
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  Zoho Books ERP
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap shrink-0">
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
        </div>
      </div>

      {/* Stats with Realtime */}
      <StatsCards />

      {/* Transaction Feed with Realtime */}
      <TransactionFeed />
    </div>
  );
}
