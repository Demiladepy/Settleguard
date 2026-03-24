import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/seed — Seed demo data for hackathon demo.
 * Creates invoices, ISW transactions, bank settlements, and a dispute scenario.
 */
export async function POST() {
  try {
    // ── 1. ERP Invoices (what the business expects) ──────────────────
    const invoices = [
      { invoice_number: "INV1041", customer_name: "Adebayo Motors Ltd", customer_email: "accounts@adebayomotors.ng", amount_kobo: 15000000, status: "sent", due_date: "2026-03-28" },
      { invoice_number: "INV1042", customer_name: "Lagos Fresh Produce", customer_email: "pay@lagosfresh.com", amount_kobo: 8750000, status: "sent", due_date: "2026-03-25" },
      { invoice_number: "INV1043", customer_name: "TechHub Ikeja", customer_email: "billing@techhubikeja.ng", amount_kobo: 3500000, status: "sent", due_date: "2026-03-30" },
      { invoice_number: "INV1044", customer_name: "Eko Atlantic Hotels", customer_email: "finance@ekoatlantic.com", amount_kobo: 22000000, status: "sent", due_date: "2026-03-26" },
      { invoice_number: "INV1045", customer_name: "Ogun Steel Works", customer_email: "payments@ogunsteel.ng", amount_kobo: 47500000, status: "sent", due_date: "2026-03-29" },
      { invoice_number: "INV1046", customer_name: "Abuja Express Logistics", customer_email: "ap@abujaexpress.com", amount_kobo: 6200000, status: "sent", due_date: "2026-03-27" },
      { invoice_number: "INV1047", customer_name: "Kano Textiles Int'l", customer_email: "orders@kanotextiles.ng", amount_kobo: 18500000, status: "sent", due_date: "2026-03-31" },
      { invoice_number: "INV1048", customer_name: "Port Harcourt Shipping", customer_email: "accounts@phshipping.com", amount_kobo: 31000000, status: "paid", due_date: "2026-03-20" },
      { invoice_number: "INV1049", customer_name: "Ibadan Farm Supplies", customer_email: "pay@ibadanfarms.ng", amount_kobo: 5400000, status: "sent", due_date: "2026-03-28" },
      { invoice_number: "INV1050", customer_name: "Victoria Island Consulting", customer_email: "billing@viconsult.com", amount_kobo: 12000000, status: "overdue", due_date: "2026-03-15" },
    ];

    const { error: invErr } = await supabaseAdmin.from("erp_invoices").upsert(invoices, { onConflict: "invoice_number" });
    if (invErr) throw new Error(`Invoice seed failed: ${invErr.message}`);

    // ── 2. ISW Transactions (what Interswitch says happened) ─────────
    const iswTransactions = [
      // Settlement Batch BATCH7721 — 5 transactions totaling ₦1,025,000
      { txn_ref: "SG-INV1041-1711234567001", merchant_code: "MX6072", response_code: "00", response_desc: "Approved", amount_kobo: 15000000, settlement_batch_id: "BATCH7721", transaction_date: "2026-03-22T10:15:00Z", raw_response: { cust_email: "accounts@adebayomotors.ng" } },
      { txn_ref: "SG-INV1042-1711234567002", merchant_code: "MX6072", response_code: "00", response_desc: "Approved", amount_kobo: 8750000, settlement_batch_id: "BATCH7721", transaction_date: "2026-03-22T11:30:00Z", raw_response: { cust_email: "pay@lagosfresh.com" } },
      { txn_ref: "SG-INV1043-1711234567003", merchant_code: "MX6072", response_code: "00", response_desc: "Approved", amount_kobo: 3500000, settlement_batch_id: "BATCH7721", transaction_date: "2026-03-22T14:00:00Z", raw_response: { cust_email: "billing@techhubikeja.ng" } },
      { txn_ref: "SG-INV1044-1711234567004", merchant_code: "MX6072", response_code: "00", response_desc: "Approved", amount_kobo: 22000000, settlement_batch_id: "BATCH7721", transaction_date: "2026-03-22T15:45:00Z", raw_response: { cust_email: "finance@ekoatlantic.com" } },
      { txn_ref: "SG-INV1045-1711234567005", merchant_code: "MX6072", response_code: "00", response_desc: "Approved", amount_kobo: 47500000, settlement_batch_id: "BATCH7721", transaction_date: "2026-03-22T16:20:00Z", raw_response: { cust_email: "payments@ogunsteel.ng" } },

      // Settlement Batch BATCH7722 — 3 transactions
      { txn_ref: "SG-INV1046-1711234567006", merchant_code: "MX6072", response_code: "00", response_desc: "Approved", amount_kobo: 6200000, settlement_batch_id: "BATCH7722", transaction_date: "2026-03-23T09:00:00Z", raw_response: { cust_email: "ap@abujaexpress.com" } },
      { txn_ref: "SG-INV1047-1711234567007", merchant_code: "MX6072", response_code: "00", response_desc: "Approved", amount_kobo: 18500000, settlement_batch_id: "BATCH7722", transaction_date: "2026-03-23T10:30:00Z", raw_response: { cust_email: "orders@kanotextiles.ng" } },
      { txn_ref: "SG-INV1049-1711234567009", merchant_code: "MX6072", response_code: "00", response_desc: "Approved", amount_kobo: 5400000, settlement_batch_id: "BATCH7722", transaction_date: "2026-03-23T12:15:00Z", raw_response: { cust_email: "pay@ibadanfarms.ng" } },

      // Orphan ISW — no matching invoice (the dispute scenario!)
      { txn_ref: "SG-UNKNOWN-1711234567010", merchant_code: "MX6072", response_code: "00", response_desc: "Approved", amount_kobo: 3500000, settlement_batch_id: "BATCH7722", transaction_date: "2026-03-23T13:00:00Z", raw_response: { cust_email: "mystery@unknown.com" } },

      // Failed transaction (should not reconcile)
      { txn_ref: "SG-INV1050-1711234567011", merchant_code: "MX6072", response_code: "51", response_desc: "Insufficient Funds", amount_kobo: 12000000, settlement_batch_id: null, transaction_date: "2026-03-23T14:00:00Z", raw_response: { cust_email: "billing@viconsult.com" } },
    ];

    const { error: iswErr } = await supabaseAdmin.from("isw_transactions").upsert(iswTransactions, { onConflict: "txn_ref" });
    if (iswErr) throw new Error(`ISW seed failed: ${iswErr.message}`);

    // ── 3. Bank Transactions (what the bank shows) ───────────────────
    // BATCH7721: 5 ISW txns summing to ₦967,500 — but bank shows ₦967,500 (exact match)
    // BATCH7722: 4 ISW txns (including orphan) summing to ₦336,000 — bank shows ₦301,000 (mismatch! the orphan ₦35,000 makes it not match)
    const batch7721Total = 15000000 + 8750000 + 3500000 + 22000000 + 47500000; // 96,750,000 kobo
    const batch7722Total = 6200000 + 18500000 + 5400000 + 3500000; // 33,600,000 kobo

    const bankTransactions = [
      {
        mono_id: "mono_txn_001",
        bank_name: "First Bank Nigeria",
        account_number_masked: "****4521",
        narration: "ISW SETTLEMENT/MX6072/260322/BATCH7721",
        amount_kobo: batch7721Total,
        transaction_type: "credit",
        transaction_date: "2026-03-24T06:00:00Z",
        balance_after: 150000000,
      },
      {
        mono_id: "mono_txn_002",
        bank_name: "First Bank Nigeria",
        account_number_masked: "****4521",
        narration: "ISW SETTLEMENT/MX6072/260323/BATCH7722",
        amount_kobo: batch7722Total - 3500000, // Missing the orphan ₦35,000 — mismatch!
        transaction_type: "credit",
        transaction_date: "2026-03-25T06:00:00Z",
        balance_after: 180100000,
      },
      // Mystery bank credit — no ISW match (orphan_bank scenario)
      {
        mono_id: "mono_txn_003",
        bank_name: "First Bank Nigeria",
        account_number_masked: "****4521",
        narration: "TRANSFER FROM UNKNOWN/REF9988776",
        amount_kobo: 7500000,
        transaction_type: "credit",
        transaction_date: "2026-03-24T12:00:00Z",
        balance_after: 157500000,
      },
      // Regular debit (should be ignored by reconciliation)
      {
        mono_id: "mono_txn_004",
        bank_name: "First Bank Nigeria",
        account_number_masked: "****4521",
        narration: "POS PURCHASE/SHOPRITE LEKKI",
        amount_kobo: 4500000,
        transaction_type: "debit",
        transaction_date: "2026-03-24T15:30:00Z",
        balance_after: 153000000,
      },
    ];

    const { error: bankErr } = await supabaseAdmin.from("bank_transactions").upsert(bankTransactions, { onConflict: "mono_id" });
    if (bankErr) throw new Error(`Bank seed failed: ${bankErr.message}`);

    return NextResponse.json({
      success: true,
      seeded: {
        invoices: invoices.length,
        isw_transactions: iswTransactions.length,
        bank_transactions: bankTransactions.length,
      },
      demo_scenarios: {
        batch7721: `5 ISW txns → 1 bank deposit of ${(batch7721Total / 100).toLocaleString("en-NG")} NGN (should fully match)`,
        batch7722: `4 ISW txns → bank deposit short by ₦35,000 (orphan ISW + amount mismatch)`,
        orphan_bank: "₦75,000 mystery credit with no ISW match",
        orphan_invoice: "INV1048 marked paid but no ISW record",
        failed_payment: "INV1050 payment declined (insufficient funds)",
      },
    });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 }
    );
  }
}
