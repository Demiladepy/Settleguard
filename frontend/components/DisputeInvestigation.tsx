"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { DisputeCard } from "./disputes/DisputeCard";

interface Dispute {
  id: string;
  reason: string;
  priority: string;
  ai_recommendation: string | null;
  ai_confidence: number | null;
  ai_investigation: { tool_calls?: Array<{ tool: string; input: Record<string, unknown>; output: string }>; evidence?: string[] } | null;
  resolution: string | null;
  resolved_by: string | null;
  created_at: string;
}

export function DisputeInvestigation() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newReason, setNewReason] = useState("");

  const fetchDisputes = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("disputes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setDisputes(data || []);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDisputes();

    // Realtime
    const channel = supabase
      .channel("disputes-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, () => fetchDisputes())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchDisputes]);

  const createDispute = async () => {
    if (!newReason.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: newReason, priority: "medium" }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Dispute created");
        setNewReason("");
        fetchDisputes();
      }
    } catch {
      toast.error("Failed to create dispute");
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">AI Dispute Investigation</h1>
        <p className="text-gray-400 text-sm mt-1">
          AI agent investigates discrepancies across all three data sources in real time
        </p>
      </div>

      {/* Create dispute */}
      <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-5">
        <h2 className="font-semibold mb-3">Create New Dispute</h2>
        <div className="flex gap-3">
          <input
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createDispute()}
            placeholder="Describe the discrepancy..."
            className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600"
          />
          <button
            onClick={createDispute}
            disabled={creating || !newReason.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>

      {/* Disputes list */}
      {disputes.length === 0 ? (
        <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">
            No disputes yet. Run reconciliation to auto-detect discrepancies, or
            create one manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <DisputeCard key={d.id} dispute={d} onUpdated={fetchDisputes} />
          ))}
        </div>
      )}
    </div>
  );
}
