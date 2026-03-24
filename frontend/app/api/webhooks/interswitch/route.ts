import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyIswTransaction, isSuccessful } from "@/lib/interswitch";
import { reconcileSingle } from "@/lib/reconciliation-engine";
import { appendToAuditChain } from "@/lib/audit-chain";

/**
 * ISW webhook / payment callback handler.
 * 1. Receives txn_ref + invoice_id from client after payment
 * 2. Re-queries ISW server-side (never trust client)
 * 3. Stores verified transaction
 * 4. Triggers realtime reconciliation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { txn_ref, invoice_id, amount_kobo } = body;

    if (!txn_ref) {
      return NextResponse.json({ error: "txn_ref required" }, { status: 400 });
    }

    // Look up expected amount from invoice if we have one
    let expectedAmount = amount_kobo;
    if (!expectedAmount && invoice_id) {
      const { data: invoice } = await supabaseAdmin
        .from("erp_invoices")
        .select("amount_kobo")
        .eq("id", invoice_id)
        .single();
      expectedAmount = invoice?.amount_kobo;
    }

    if (!expectedAmount) {
      return NextResponse.json(
        { error: "amount_kobo or valid invoice_id required" },
        { status: 400 }
      );
    }

    // Server-side verification with ISW
    const iswResponse = await verifyIswTransaction(txn_ref, expectedAmount);

    // Store the transaction
    const { data: txn, error } = await supabaseAdmin
      .from("isw_transactions")
      .upsert(
        {
          txn_ref,
          merchant_code: process.env.ISW_MERCHANT_CODE || "MX6072",
          response_code: iswResponse.ResponseCode,
          response_desc: iswResponse.ResponseDescription,
          amount_kobo: iswResponse.Amount || expectedAmount,
          payment_reference: iswResponse.PaymentReference || null,
          card_number_masked: iswResponse.CardNumber || null,
          transaction_date: iswResponse.TransactionDate || new Date().toISOString(),
          raw_response: iswResponse,
        },
        { onConflict: "txn_ref" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit
    await appendToAuditChain({
      event_type: isSuccessful(iswResponse.ResponseCode) ? "payment_confirmed" : "payment_failed",
      entity_type: "isw_transaction",
      entity_id: txn.id,
      actor: "isw_webhook",
      payload: { txn_ref, response_code: iswResponse.ResponseCode, amount_kobo: txn.amount_kobo },
    });

    // If successful, trigger realtime reconciliation
    let match = null;
    if (isSuccessful(iswResponse.ResponseCode)) {
      match = await reconcileSingle(txn.id);

      // Update invoice status if matched
      if (match?.erp_invoice_id) {
        await supabaseAdmin
          .from("erp_invoices")
          .update({ status: "paid" })
          .eq("id", match.erp_invoice_id);
      }
    }

    return NextResponse.json({
      success: isSuccessful(iswResponse.ResponseCode),
      transaction: txn,
      reconciliation: match,
    });
  } catch (err) {
    console.error("ISW webhook error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
