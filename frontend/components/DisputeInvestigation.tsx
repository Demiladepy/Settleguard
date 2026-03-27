"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
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
        <RefreshCw className="w-5 h-5 animate-sg-spin text-sg-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-mono font-bold text-sg-text">AI Dispute Investigation</h1>
        <p className="text-sg-text-tertiary text-[13px] mt-0.5">
          AI agent investigates discrepancies across all three data sources
        </p>
      </div>

      {/* Create dispute */}
      <div className="bg-sg-bg-card border border-sg-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-sg-text mb-3">Create New Dispute</h2>
        <div className="flex gap-2">
          <input
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createDispute()}
            placeholder="Describe the discrepancy..."
            className="flex-1 bg-sg-bg border border-sg-border rounded-md px-3 py-2 text-[13px] text-sg-text placeholder-sg-text-tertiary focus:outline-none focus:border-sg-accent/50 font-sans"
          />
          <button
            onClick={createDispute}
            disabled={creating || !newReason.trim()}
            className="px-4 py-2 bg-sg-accent/10 border border-sg-accent/30 hover:bg-sg-accent/20 rounded-md text-[13px] font-medium text-sg-accent transition-colors disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>

      {/* Disputes list */}
      {disputes.length === 0 ? (
        <div className="bg-sg-bg-card border border-sg-border rounded-lg p-8 text-center">
          <p className="text-sg-text-tertiary text-sm">
            No disputes yet. Run reconciliation to auto-detect, or create one manually.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <DisputeCard key={d.id} dispute={d} onUpdated={fetchDisputes} />
          ))}
        </div>
      )}
    </div>
  );
}
