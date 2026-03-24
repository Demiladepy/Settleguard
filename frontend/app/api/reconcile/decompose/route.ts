import { NextRequest, NextResponse } from "next/server";
import { decomposeSettlement, decomposeByBankTransaction } from "@/lib/settlement-decomposer";
import { koboToNaira } from "@/lib/interswitch";

/**
 * POST /api/reconcile/decompose
 * Decompose a bank settlement into individual ISW transactions.
 * Accepts either { batch_id } or { bank_transaction_id }.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { batch_id, bank_transaction_id } = body;

    if (bank_transaction_id) {
      const result = await decomposeByBankTransaction(bank_transaction_id);
      if (!result) {
        return NextResponse.json({ error: "Bank transaction not found" }, { status: 404 });
      }

      return NextResponse.json({
        batch_id: result.batchId,
        bank_transaction: {
          id: result.bankTransaction.id,
          narration: result.bankTransaction.narration,
          amount: koboToNaira(result.bankAmount),
          amount_kobo: result.bankAmount,
          date: result.bankTransaction.transaction_date,
        },
        transaction_count: result.iswTransactions.length,
        total_isw_amount: koboToNaira(result.totalIswAmount),
        total_isw_kobo: result.totalIswAmount,
        bank_amount: koboToNaira(result.bankAmount),
        difference: koboToNaira(Math.abs(result.difference)),
        difference_kobo: result.difference,
        is_balanced: result.isBalanced,
        match_quality: result.isBalanced ? "exact" : Math.abs(result.difference) < result.bankAmount * 0.01 ? "within_tolerance" : "mismatch",
        matched_count: result.matchedInvoices.filter((m) => m.invoice).length,
        orphan_count: result.matchedInvoices.filter((m) => !m.invoice).length,
        transactions: result.matchedInvoices.map((m) => ({
          txn_ref: m.isw.txn_ref,
          amount: koboToNaira(m.isw.amount_kobo),
          amount_kobo: m.isw.amount_kobo,
          date: m.isw.transaction_date,
          response_code: m.isw.response_code,
          invoice_match: m.invoice ? "matched" : "orphan",
          matched_invoice: m.invoice
            ? {
                invoice_number: m.invoice.invoice_number,
                customer_name: m.invoice.customer_name,
                amount: koboToNaira(m.invoice.amount_kobo as number),
              }
            : null,
        })),
      });
    }

    if (batch_id) {
      const result = await decomposeSettlement(batch_id);
      if (!result) {
        return NextResponse.json({ error: "No transactions found for this batch" }, { status: 404 });
      }

      return NextResponse.json({
        batch_id: result.batchId,
        transaction_count: result.iswTransactions.length,
        total_isw_amount: koboToNaira(result.totalIswAmount),
        bank_amount: koboToNaira(result.bankAmount),
        difference: koboToNaira(Math.abs(result.difference)),
        is_balanced: result.isBalanced,
        transactions: result.iswTransactions.map((t) => ({
          txn_ref: t.txn_ref,
          amount: koboToNaira(t.amount_kobo),
          amount_kobo: t.amount_kobo,
          date: t.transaction_date,
          response_code: t.response_code,
        })),
      });
    }

    return NextResponse.json({ error: "batch_id or bank_transaction_id required" }, { status: 400 });
  } catch (err) {
    console.error("Decompose error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Decomposition failed" },
      { status: 500 }
    );
  }
}
