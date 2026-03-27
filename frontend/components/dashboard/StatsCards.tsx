"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Stats {
  totalProcessed: number;
  totalAmountKobo: number;
  matchedCount: number;
  matchedPercent: number;
  pendingCount: number;
  activeDisputes: number;
}

function koboToNaira(k: number) {
  const n = k / 100;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}K`;
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
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

    const channel = supabase
      .channel("stats-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "isw_transactions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reconciliation_matches" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards: {
    label: string;
    value: string;
    sub: string;
    borderColor: string;
  }[] = [
    {
      label: "PROCESSED TODAY",
      value: koboToNaira(stats.totalAmountKobo),
      sub: `${stats.totalProcessed} transactions`,
      borderColor: "border-l-sg-accent",
    },
    {
      label: "MATCH RATE",
      value: `${stats.matchedPercent}%`,
      sub: `${stats.matchedCount} matched`,
      borderColor: "border-l-sg-matched",
    },
    {
      label: "PENDING SETTLEMENT",
      value: stats.pendingCount.toString(),
      sub: "Awaiting bank confirmation",
      borderColor: "border-l-sg-pending",
    },
    {
      label: "ACTIVE DISPUTES",
      value: stats.activeDisputes.toString(),
      sub: stats.activeDisputes > 0 ? "Needs attention" : "All clear",
      borderColor: `border-l-${stats.activeDisputes > 0 ? "sg-mismatch" : "sg-text-tertiary"}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`bg-sg-bg-card border border-sg-border border-l-2 ${card.borderColor} rounded-lg p-4`}
        >
          <p className="text-sg-text-tertiary text-[11px] font-medium uppercase tracking-wider mb-2">
            {card.label}
          </p>
          <p className="text-sg-text text-[28px] font-mono font-bold leading-none">
            {card.value}
          </p>
          <p className="text-sg-text-tertiary text-xs mt-1.5">
            {card.sub}
          </p>
        </div>
      ))}
    </div>
  );
}
