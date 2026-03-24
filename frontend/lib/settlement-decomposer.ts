import { supabaseAdmin } from "./supabase";
import type { IswTransaction, BankTransaction } from "./supabase";

/**
 * Settlement Decomposer
 *
 * Interswitch settles multiple transactions as one lump sum to the merchant's bank.
 * This module decomposes a single bank deposit back into individual ISW transactions.
 */

export interface SettlementBreakdown {
  bankTransaction: BankTransaction;
  batchId: string;
  iswTransactions: IswTransaction[];
  totalIswAmount: number;
  bankAmount: number;
  difference: number;
  isBalanced: boolean;
  missingAmount: number;
  unmatchedTransactions: IswTransaction[];
}

/**
 * Decompose a bank settlement into individual ISW transactions by batch ID
 */
export async function decomposeSettlement(
  batchId: string
): Promise<SettlementBreakdown | null> {
  // Get all ISW transactions in this batch
  const { data: iswTxns, error: iswErr } = await supabaseAdmin
    .from("isw_transactions")
    .select("*")
    .eq("settlement_batch_id", batchId)
    .order("transaction_date", { ascending: true });

  if (iswErr) throw new Error(`Failed to query ISW transactions: ${iswErr.message}`);
  if (!iswTxns || iswTxns.length === 0) return null;

  // Find the matching bank deposit (narration contains batch ID)
  const { data: bankTxns, error: bankErr } = await supabaseAdmin
    .from("bank_transactions")
    .select("*")
    .eq("transaction_type", "credit")
    .ilike("narration", `%${batchId}%`)
    .limit(1);

  if (bankErr) throw new Error(`Failed to query bank transactions: ${bankErr.message}`);

  const bankTxn = bankTxns?.[0] || null;
  const totalIswAmount = iswTxns.reduce((sum, t) => sum + t.amount_kobo, 0);
  const bankAmount = bankTxn?.amount_kobo || 0;
  const difference = bankAmount - totalIswAmount;

  return {
    bankTransaction: bankTxn!,
    batchId,
    iswTransactions: iswTxns,
    totalIswAmount,
    bankAmount,
    difference,
    isBalanced: Math.abs(difference) < 100, // within ₦1 tolerance
    missingAmount: difference < 0 ? Math.abs(difference) : 0,
    unmatchedTransactions: [], // populated by reconciliation engine
  };
}

/**
 * Find all settlement batches within a date range
 */
export async function findSettlementBatches(
  startDate: string,
  endDate: string
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("isw_transactions")
    .select("settlement_batch_id")
    .not("settlement_batch_id", "is", null)
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate);

  if (error) throw new Error(`Failed to query batches: ${error.message}`);

  const batchIds = [...new Set((data || []).map((d) => d.settlement_batch_id))];
  return batchIds.filter(Boolean) as string[];
}

/**
 * Decompose a bank settlement by bank transaction ID.
 * Tries batch ID from narration first, then falls back to subset-sum matching.
 */
export async function decomposeByBankTransaction(
  bankTransactionId: string
): Promise<SettlementBreakdown & { matchedInvoices: Array<{ isw: IswTransaction; invoice: Record<string, unknown> | null }> } | null> {
  // Get the bank transaction
  const { data: bankTxn, error: bankErr } = await supabaseAdmin
    .from("bank_transactions")
    .select("*")
    .eq("id", bankTransactionId)
    .single();

  if (bankErr || !bankTxn) return null;

  // Try to extract batch ID from narration
  const batchId = extractBatchId(bankTxn.narration);
  let iswTxns: IswTransaction[] = [];

  if (batchId) {
    const { data } = await supabaseAdmin
      .from("isw_transactions")
      .select("*")
      .eq("settlement_batch_id", batchId)
      .eq("response_code", "00")
      .order("transaction_date", { ascending: true });
    iswTxns = data || [];
  }

  // Fallback: find ISW txns by amount subset-sum matching within 3-day window
  if (iswTxns.length === 0) {
    const bankDate = new Date(bankTxn.transaction_date);
    const threeDaysBefore = new Date(bankDate.getTime() - 3 * 86_400_000);

    const { data: candidates } = await supabaseAdmin
      .from("isw_transactions")
      .select("*")
      .eq("response_code", "00")
      .gte("transaction_date", threeDaysBefore.toISOString())
      .lte("transaction_date", bankDate.toISOString())
      .order("transaction_date", { ascending: true });

    iswTxns = findSubsetSum(candidates || [], bankTxn.amount_kobo);
  }

  const totalIswAmount = iswTxns.reduce((s, t) => s + t.amount_kobo, 0);
  const difference = bankTxn.amount_kobo - totalIswAmount;

  // Match each ISW txn to an invoice
  const matchedInvoices = await Promise.all(
    iswTxns.map(async (isw) => {
      const { data: invoice } = await supabaseAdmin
        .from("erp_invoices")
        .select("*")
        .eq("amount_kobo", isw.amount_kobo)
        .in("status", ["sent", "overdue", "paid"])
        .limit(1)
        .single();
      return { isw, invoice: invoice as Record<string, unknown> | null };
    })
  );

  return {
    bankTransaction: bankTxn,
    batchId: batchId || "UNKNOWN",
    iswTransactions: iswTxns,
    totalIswAmount,
    bankAmount: bankTxn.amount_kobo,
    difference,
    isBalanced: Math.abs(difference) < 100,
    missingAmount: difference < 0 ? Math.abs(difference) : 0,
    unmatchedTransactions: iswTxns.filter(
      (_, i) => !matchedInvoices[i]?.invoice
    ),
    matchedInvoices,
  };
}

/**
 * Greedy subset-sum: find transactions that sum to target amount.
 * Sorts by amount descending for best fit, then fills greedily.
 */
function findSubsetSum(
  candidates: IswTransaction[],
  target: number
): IswTransaction[] {
  // Sort descending for better greedy fit
  const sorted = [...candidates].sort((a, b) => b.amount_kobo - a.amount_kobo);
  const result: IswTransaction[] = [];
  let sum = 0;

  for (const c of sorted) {
    if (sum + c.amount_kobo <= target) {
      result.push(c);
      sum += c.amount_kobo;
    }
    if (sum === target) break;
  }

  // If greedy didn't get exact match, try ascending order too
  if (sum !== target) {
    const ascSorted = [...candidates].sort((a, b) => a.amount_kobo - b.amount_kobo);
    const result2: IswTransaction[] = [];
    let sum2 = 0;
    for (const c of ascSorted) {
      if (sum2 + c.amount_kobo <= target) {
        result2.push(c);
        sum2 += c.amount_kobo;
      }
      if (sum2 === target) break;
    }
    // Return whichever is closer
    if (Math.abs(target - sum2) < Math.abs(target - sum)) {
      return result2;
    }
  }

  return result;
}

/**
 * Auto-detect batch ID from a bank narration
 */
export function extractBatchId(narration: string): string | null {
  // Pattern: "ISW SETTLEMENT/MX6072/250324/BATCH7721"
  const batchMatch = narration.match(/BATCH(\w+)/i);
  if (batchMatch) return batchMatch[0];

  // Pattern: settlement reference number
  const refMatch = narration.match(/ISW[^\d]*(\d{6,})/i);
  if (refMatch) return `REF${refMatch[1]}`;

  return null;
}
