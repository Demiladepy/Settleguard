import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchBankTransactions, monoToBankTransaction } from "@/lib/mono";

/**
 * Sync bank transactions from Mono (or acknowledge seeded data).
 * POST /api/sources/sync-bank
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { account_id, start_date, end_date } = body;

    if (!account_id) {
      // No Mono account — just report what's seeded
      const { count } = await supabaseAdmin
        .from("bank_transactions")
        .select("*", { count: "exact", head: true });

      return NextResponse.json({
        source: "seeded_data",
        total: count || 0,
        message: "No Mono account ID provided. Using seeded bank transaction data.",
      });
    }

    // Pull from Mono
    const monoTxns = await fetchBankTransactions(account_id, start_date, end_date);

    if (monoTxns.length === 0) {
      return NextResponse.json({ synced: 0, message: "No new transactions from Mono" });
    }

    const records = monoTxns.map(monoToBankTransaction);

    const { data, error } = await supabaseAdmin
      .from("bank_transactions")
      .upsert(records, { onConflict: "mono_id" })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ synced: data?.length || 0, source: "mono" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("bank_transactions")
    .select("*")
    .order("transaction_date", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transactions: data });
}
