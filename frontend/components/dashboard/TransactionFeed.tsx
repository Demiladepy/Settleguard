"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MatchStatusBadge } from "./MatchStatusBadge";

interface IswTxn {
  id: string;
  txn_ref: string;
  amount_kobo: number;
  response_code: string | null;
  response_desc: string | null;
  transaction_date: string | null;
  settlement_batch_id: string | null;
  created_at: string;
  isNew?: boolean;
}

function koboToNaira(k: number) {
  return `₦${(k / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function TransactionFeed() {
  const [transactions, setTransactions] = useState<IswTxn[]>([]);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    supabase
      .from("isw_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setTransactions(data || []));

    const channel = supabase
      .channel("isw-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "isw_transactions" },
        (payload) => {
          const newTxn = { ...(payload.new as IswTxn), isNew: true };
          setTransactions((prev) => [newTxn, ...prev].slice(0, 20));
          setTimeout(() => {
            setTransactions((prev) =>
              prev.map((t) => (t.id === newTxn.id ? { ...t, isNew: false } : t))
            );
          }, 2000);
        }
      )
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="bg-sg-bg-card border border-sg-border rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sg-border">
        <h2 className="text-sg-text text-sm font-semibold">ISW Transaction Feed</h2>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-sg-matched animate-sg-pulse" : "bg-sg-text-tertiary"}`} />
          <span className={`text-[11px] font-mono ${isLive ? "text-sg-matched" : "text-sg-text-tertiary"}`}>
            {isLive ? "LIVE" : "..."}
          </span>
        </div>
      </div>

      {/* Feed */}
      {transactions.length === 0 ? (
        <p className="text-sg-text-tertiary text-sm py-8 text-center">
          No transactions yet. Seed data or make a payment.
        </p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto sg-scrollbar">
          {transactions.map((txn) => (
            <div
              key={txn.id}
              className={`flex items-center justify-between px-4 py-2.5 border-b border-sg-border/50 border-l-2 transition-all duration-500 hover:bg-sg-bg-hover/50 ${
                txn.isNew
                  ? "border-l-sg-accent bg-sg-accent/5 animate-sg-slide-in"
                  : "border-l-transparent"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-mono text-sg-text truncate max-w-[180px]">
                    {txn.txn_ref}
                  </span>
                  <MatchStatusBadge
                    status={txn.response_code === "00" ? "success" : "failed"}
                  />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {txn.settlement_batch_id && (
                    <span className="text-[11px] font-mono text-sg-text-tertiary">
                      {txn.settlement_batch_id}
                    </span>
                  )}
                  <span className="text-[11px] text-sg-text-tertiary">
                    {timeAgo(txn.transaction_date || txn.created_at)}
                  </span>
                </div>
              </div>
              <span className="text-[13px] font-mono font-bold text-sg-text ml-4 tabular-nums">
                {koboToNaira(txn.amount_kobo)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
