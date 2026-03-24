"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Activity, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

interface Stats {
  totalProcessed: number;
  totalAmountKobo: number;
  matchedCount: number;
  matchedPercent: number;
  pendingCount: number;
  activeDisputes: number;
}

function koboToNaira(k: number) {
  return `₦${(k / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

export function StatsCards() {
  const [stats, setStats] = useState<Stats>({
    totalProcessed: 0,
    totalAmountKobo: 0,
    matchedCount: 0,
    matchedPercent: 0,
    pendingCount: 0,
    activeDisputes: 0,
  });

  useEffect(() => {
    async function load() {
      const [iswRes, matchRes, pendRes, dispRes] = await Promise.all([
        supabase.from("isw_transactions").select("amount_kobo").eq("response_code", "00"),
        supabase.from("reconciliation_matches").select("id", { count: "exact", head: true }).eq("match_status", "full_match"),
        supabase.from("reconciliation_matches").select("id", { count: "exact", head: true }).eq("match_status", "settlement_pending"),
        supabase.from("disputes").select("id", { count: "exact", head: true }).is("resolved_at", null),
      ]);

      const txns = iswRes.data || [];
      const totalAmt = txns.reduce((s, t) => s + (t.amount_kobo || 0), 0);
      const totalCount = txns.length;
      const matched = matchRes.count || 0;

      setStats({
        totalProcessed: totalCount,
        totalAmountKobo: totalAmt,
        matchedCount: matched,
        matchedPercent: totalCount > 0 ? Math.round((matched / totalCount) * 100) : 0,
        pendingCount: pendRes.count || 0,
        activeDisputes: dispRes.count || 0,
      });
    }

    load();

    // Realtime: refresh on any isw_transactions change
    const channel = supabase
      .channel("stats-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "isw_transactions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reconciliation_matches" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        icon={Activity}
        label="Total Processed"
        value={stats.totalProcessed.toString()}
        sub={koboToNaira(stats.totalAmountKobo)}
        color="text-gray-300"
      />
      <Card
        icon={CheckCircle2}
        label="Matched"
        value={stats.matchedCount.toString()}
        sub={`${stats.matchedPercent}% match rate`}
        color="text-emerald-400"
      />
      <Card
        icon={Clock}
        label="Pending Settlement"
        value={stats.pendingCount.toString()}
        sub="Awaiting bank confirmation"
        color="text-yellow-400"
      />
      <Card
        icon={AlertTriangle}
        label="Active Disputes"
        value={stats.activeDisputes.toString()}
        sub={stats.activeDisputes > 0 ? "Needs attention" : "All clear"}
        color={stats.activeDisputes > 0 ? "text-red-400" : "text-gray-400"}
      />
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-gray-500 text-xs mt-1">{sub}</p>
    </div>
  );
}
