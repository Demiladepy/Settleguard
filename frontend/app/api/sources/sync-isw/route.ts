import { NextResponse } from "next/server";
import { searchIswTransactions, pullIswTransactionsForReconciliation } from "@/lib/interswitch";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/sources/sync-isw
 * Pull transactions from Interswitch Transaction Search API and sync to Supabase.
 * Body: { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const today = new Date().toISOString().split("T")[0];
    const startDate = body.startDate || today;
    const endDate = body.endDate || today;

    // Pull from ISW Transaction Search API
    const iswTransactions = await pullIswTransactionsForReconciliation(startDate, endDate);

    if (iswTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No transactions found on ISW for the given date range. Using seeded data for demo.",
        synced: 0,
        startDate,
        endDate,
      });
    }

    // Map ISW records to our schema and upsert into Supabase
    const mapped = iswTransactions.map((txn) => ({
      transaction_ref: txn.transactionReference,
      payment_ref: txn.paymentReference,
      amount_kobo: txn.amount,
      response_code: txn.responseCode,
      response_description: txn.responseDescription,
      channel: txn.channel || "WEB",
      transaction_date: txn.transactionDate,
      settlement_status: txn.settlementStatus || "PENDING",
      raw_response: txn,
    }));

    const { error } = await supabaseAdmin
      .from("isw_transactions")
      .upsert(mapped, { onConflict: "transaction_ref" });

    if (error) {
      console.error("Supabase upsert error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      synced: mapped.length,
      startDate,
      endDate,
      message: `Pulled ${mapped.length} transactions from Interswitch`,
    });
  } catch (err) {
    console.error("ISW sync error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "ISW sync failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sources/sync-isw?ref=TXN_REF
 * Quick lookup of a single transaction on ISW network.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref");
  const startDate = searchParams.get("startDate") || new Date().toISOString().split("T")[0];
  const endDate = searchParams.get("endDate") || startDate;

  try {
    if (ref) {
      // Single transaction lookup
      const result = await searchIswTransactions({ transactionRef: ref });
      return NextResponse.json({ success: true, ...result });
    }

    // Date range search
    const result = await searchIswTransactions({ startDate, endDate, pageSize: 20 });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}
