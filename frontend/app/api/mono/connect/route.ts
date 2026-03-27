import { NextRequest, NextResponse } from "next/server";
import { exchangeMonoCode, fetchBankTransactions, monoToBankTransaction, getAccountInfo } from "@/lib/mono";
import { supabaseAdmin } from "@/lib/supabase";
import { appendToAuditChain } from "@/lib/audit-chain";

/**
 * POST /api/mono/connect
 * Exchange Mono Connect auth code for account ID, then sync transactions.
 */
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Mono auth code required" }, { status: 400 });
    }

    // Exchange code for account ID
    const { id: accountId } = await exchangeMonoCode(code);

    // Get account info
    const accountInfo = await getAccountInfo(accountId);

    // Fetch recent transactions (last 90 days)
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    const monoTxns = await fetchBankTransactions(accountId, startDate, endDate);

    // Store transactions
    let synced = 0;
    if (monoTxns.length > 0) {
      const records = monoTxns.map(monoToBankTransaction);
      const { data } = await supabaseAdmin
        .from("bank_transactions")
        .upsert(records, { onConflict: "mono_id" })
        .select();
      synced = data?.length || 0;
    }

    // Audit the connection
    await appendToAuditChain({
      event_type: "bank_account_linked",
      entity_type: "mono_account",
      entity_id: accountId,
      actor: "user",
      payload: {
        institution: accountInfo?.account?.institution?.name || "unknown",
        transactions_synced: synced,
      },
    });

    return NextResponse.json({
      success: true,
      account_id: accountId,
      institution: accountInfo?.account?.institution?.name || null,
      transactions_synced: synced,
    });
  } catch (err) {
    console.error("Mono connect error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to connect bank account" },
      { status: 500 }
    );
  }
}
