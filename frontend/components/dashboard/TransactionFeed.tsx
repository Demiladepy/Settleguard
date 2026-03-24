"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MatchStatusBadge } from "./MatchStatusBadge";
import { ArrowDownLeft, Wifi } from "lucide-react";

interface IswTxn {
  id: string;
  txn_ref: string;
  amount_kobo: number;
  response_code: string | null;
  response_desc: string | null;
  transaction_date: string | null;
  settlement_batch_id: string | null;
  created_at: string;
}

function koboToNaira(k: number) {
  return `₦${(k / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

export function TransactionFeed() {
  const [transactions, setTransactions] = useState<IswTxn[]>([]);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    // Initial load
    supabase
      .from("isw_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setTransactions(data || []));

    // Realtime subscription
    const channel = supabase
      .channel("isw-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "isw_transactions" },
        (payload) => {
          setTransactions((prev) =>
            [payload.new as IswTxn, ...prev].slice(0, 20)
          );
        }
      )
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowDownLeft className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold">Transaction Feed</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Wifi className={`w-3.5 h-3.5 ${isLive ? "text-emerald-400" : "text-gray-600"}`} />
          <span className={`text-xs ${isLive ? "text-emerald-400" : "text-gray-500"}`}>
            {isLive ? "Live" : "Connecting..."}
          </span>
        </div>
      </div>

      {transactions.length === 0 ? (
        <p className="text-gray-500 text-sm py-4">
          No transactions yet. Make a payment from the Demo page or seed data.
        </p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {transactions.map((txn) => (
            <div
              key={txn.id}
              className="flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-3 hover:bg-gray-800/60 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-gray-300 truncate">
                    {txn.txn_ref}
                  </span>
                  <MatchStatusBadge
                    status={txn.response_code === "00" ? "success" : "failed"}
                  />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {txn.settlement_batch_id && (
                    <span className="text-xs text-gray-500">
                      Batch: {txn.settlement_batch_id}
                    </span>
                  )}
                  <span className="text-xs text-gray-600">
                    {txn.transaction_date
                      ? new Date(txn.transaction_date).toLocaleString()
                      : new Date(txn.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <span className="text-sm font-mono font-medium text-white ml-4">
                {koboToNaira(txn.amount_kobo)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
