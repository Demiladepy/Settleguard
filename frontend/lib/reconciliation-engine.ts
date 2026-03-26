import { supabaseAdmin } from "./supabase";
import type {
  IswTransaction,
  BankTransaction,
  ErpInvoice,
  MatchStatus,
  ReconciliationMatch,
} from "./supabase";
import { appendToAuditChain } from "./audit-chain";
import { parseBatchIdFromNarration, parseMerchantCodeFromNarration } from "./interswitch";

/**
 * Three-way reconciliation engine.
 *
 * SOURCE A: Interswitch (what the payment gateway says happened)
 * SOURCE B: Bank account via Mono (what actually hit the company's bank)
 * SOURCE C: Zoho Books ERP (what the books say should have happened)
 */

// ── helpers ──────────────────────────────────────────────────────────

function amountMatch(a: number, b: number, tolerancePct = 1): boolean {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  return diff / Math.max(a, b) * 100 <= tolerancePct;
}

function dateWithinDays(
  dateA: string | null,
  dateB: string | null,
  days: number
): boolean {
  if (!dateA || !dateB) return true; // if we can't compare, don't penalise
  const diff = Math.abs(
    new Date(dateA).getTime() - new Date(dateB).getTime()
  );
  return diff <= days * 86_400_000;
}

function extractInvoiceIdFromTxnRef(txnRef: string): string | null {
  // SG-INV1047-1711234567890 → INV1047
  const m = txnRef.match(/^SG-([^-]+)-/);
  return m ? m[1] : null;
}

// ── core engine ──────────────────────────────────────────────────────

export interface ReconcileResult {
  runId: string;
  total: number;
  matched: number;
  mismatched: number;
  unmatched: number;
  matches: ReconciliationMatch[];
}

export async function runReconciliation(
  runType: "realtime" | "batch_daily" | "manual" = "manual"
): Promise<ReconcileResult> {
  // 1. Create a run record
  const { data: run, error: runErr } = await supabaseAdmin
    .from("reconciliation_runs")
    .insert({ run_type: runType, status: "running" })
    .select()
    .single();

  if (runErr) throw new Error(`Failed to create run: ${runErr.message}`);
  const runId = run.id;

  try {
    // 2. Fetch unmatched data from all three sources
    const [iswRes, bankRes, erpRes] = await Promise.all([
      supabaseAdmin.from("isw_transactions").select("*").eq("response_code", "00"),
      supabaseAdmin.from("bank_transactions").select("*").eq("transaction_type", "credit"),
      supabaseAdmin.from("erp_invoices").select("*").in("status", ["sent", "paid", "overdue"]),
    ]);

    const iswTxns: IswTransaction[] = iswRes.data || [];
    const bankTxns: BankTransaction[] = bankRes.data || [];
    const erpInvoices: ErpInvoice[] = erpRes.data || [];

    // Track which records have been matched
    const matchedBankIds = new Set<string>();
    const matchedErpIds = new Set<string>();
    const matchedIswIds = new Set<string>();

    const matches: Omit<ReconciliationMatch, "id" | "created_at">[] = [];

    // ── STEP 1: ISW ↔ ERP match ─────────────────────────────────────
    const iswErpPairs: Array<{
      isw: IswTransaction;
      erp: ErpInvoice;
      confidence: number;
    }> = [];

    for (const isw of iswTxns) {
      let bestErp: ErpInvoice | null = null;
      let bestConf = 0;

      const invoiceHint = extractInvoiceIdFromTxnRef(isw.txn_ref);

      for (const erp of erpInvoices) {
        if (matchedErpIds.has(erp.id)) continue;

        let conf = 0;

        // Amount match (exact = 0.5, within 1% = 0.3)
        if (isw.amount_kobo === erp.amount_kobo) conf += 0.5;
        else if (amountMatch(isw.amount_kobo, erp.amount_kobo)) conf += 0.3;
        else continue; // amount must at least be close

        // Invoice ID in txn_ref
        if (invoiceHint && erp.invoice_number?.includes(invoiceHint)) conf += 0.3;

        // Email match from raw ISW data
        const iswEmail = (isw.raw_response as Record<string, unknown>)?.cust_email as string | undefined;
        if (iswEmail && erp.customer_email && iswEmail.toLowerCase() === erp.customer_email.toLowerCase()) {
          conf += 0.2;
        }

        if (conf > bestConf) {
          bestConf = conf;
          bestErp = erp;
        }
      }

      if (bestErp && bestConf >= 0.5) {
        iswErpPairs.push({ isw, erp: bestErp, confidence: Math.min(bestConf, 1) });
        matchedErpIds.add(bestErp.id);
        matchedIswIds.add(isw.id);
      }
    }

    // ── STEP 2: ISW ↔ Bank match ────────────────────────────────────
    // First try individual ISW → bank matching
    const iswBankPairs: Array<{
      isw: IswTransaction;
      bank: BankTransaction;
      confidence: number;
    }> = [];

    for (const isw of iswTxns) {
      for (const bank of bankTxns) {
        if (matchedBankIds.has(bank.id)) continue;

        let conf = 0;

        // Amount match
        if (isw.amount_kobo === bank.amount_kobo) conf += 0.4;
        else if (amountMatch(isw.amount_kobo, bank.amount_kobo)) conf += 0.2;
        else continue;

        // Narration contains merchant code
        const mc = parseMerchantCodeFromNarration(bank.narration);
        if (mc) conf += 0.2;

        // Narration contains batch ID that matches
        if (isw.settlement_batch_id) {
          const bankBatch = parseBatchIdFromNarration(bank.narration);
          if (bankBatch && bankBatch === isw.settlement_batch_id) conf += 0.3;
        }

        // Date proximity (within 3 days)
        if (dateWithinDays(isw.transaction_date, bank.transaction_date, 3)) conf += 0.1;

        if (conf >= 0.5) {
          iswBankPairs.push({ isw, bank, confidence: Math.min(conf, 1) });
          matchedBankIds.add(bank.id);
          break; // one bank per ISW for individual matches
        }
      }
    }

    // Also try settlement batch matching: one bank credit = many ISW txns
    // Group ISW transactions by settlement_batch_id
    const batchGroups = new Map<string, IswTransaction[]>();
    for (const isw of iswTxns) {
      if (isw.settlement_batch_id) {
        const list = batchGroups.get(isw.settlement_batch_id) || [];
        list.push(isw);
        batchGroups.set(isw.settlement_batch_id, list);
      }
    }

    const batchBankMatches = new Map<string, BankTransaction>();
    for (const [batchId, batchTxns] of batchGroups) {
      const batchTotal = batchTxns.reduce((s, t) => s + t.amount_kobo, 0);

      for (const bank of bankTxns) {
        if (matchedBankIds.has(bank.id)) continue;
        const bankBatch = parseBatchIdFromNarration(bank.narration);
        if (bankBatch === batchId || amountMatch(batchTotal, bank.amount_kobo, 0.5)) {
          batchBankMatches.set(batchId, bank);
          matchedBankIds.add(bank.id);
          // Mark all ISW txns in this batch as having a bank match
          for (const t of batchTxns) {
            if (!iswBankPairs.some((p) => p.isw.id === t.id)) {
              iswBankPairs.push({ isw: t, bank, confidence: 0.8 });
            }
          }
          break;
        }
      }
    }

    // ── STEP 3: Three-way reconciliation ─────────────────────────────
    for (const { isw, erp, confidence: erpConf } of iswErpPairs) {
      const bankPair = iswBankPairs.find((p) => p.isw.id === isw.id);

      if (bankPair) {
        // All three sources present
        const allEqual =
          isw.amount_kobo === bankPair.bank.amount_kobo &&
          isw.amount_kobo === erp.amount_kobo;
        const batchBank = batchBankMatches.get(isw.settlement_batch_id || "");

        let status: MatchStatus;
        if (allEqual || (batchBank && isw.amount_kobo === erp.amount_kobo)) {
          status = "full_match";
        } else {
          status = "amount_mismatch";
        }

        matches.push({
          run_id: runId,
          isw_transaction_id: isw.id,
          bank_transaction_id: bankPair.bank.id,
          erp_invoice_id: erp.id,
          match_status: status,
          isw_amount: isw.amount_kobo,
          bank_amount: bankPair.bank.amount_kobo,
          erp_amount: erp.amount_kobo,
          confidence_score: Math.min((erpConf + bankPair.confidence) / 2, 1),
          match_details: {
            erp_confidence: erpConf,
            bank_confidence: bankPair.confidence,
            batch_id: isw.settlement_batch_id,
          },
        });
      } else {
        // ISW + ERP match but no bank yet → settlement pending
        matches.push({
          run_id: runId,
          isw_transaction_id: isw.id,
          bank_transaction_id: null,
          erp_invoice_id: erp.id,
          match_status: "settlement_pending",
          isw_amount: isw.amount_kobo,
          bank_amount: null,
          erp_amount: erp.amount_kobo,
          confidence_score: erpConf,
          match_details: { note: "Bank settlement not yet received" },
        });
      }
    }

    // ISW + bank but no ERP
    for (const { isw, bank, confidence } of iswBankPairs) {
      if (matchedIswIds.has(isw.id)) continue; // already in a three-way match
      matches.push({
        run_id: runId,
        isw_transaction_id: isw.id,
        bank_transaction_id: bank.id,
        erp_invoice_id: null,
        match_status: "isw_bank_match",
        isw_amount: isw.amount_kobo,
        bank_amount: bank.amount_kobo,
        erp_amount: null,
        confidence_score: confidence,
        match_details: { note: "No matching invoice found" },
      });
      matchedIswIds.add(isw.id);
    }

    // ── STEP 4: Orphan detection ─────────────────────────────────────

    // Orphan ISW: no bank, no ERP
    for (const isw of iswTxns) {
      if (matchedIswIds.has(isw.id)) continue;
      matches.push({
        run_id: runId,
        isw_transaction_id: isw.id,
        bank_transaction_id: null,
        erp_invoice_id: null,
        match_status: "orphan_isw",
        isw_amount: isw.amount_kobo,
        bank_amount: null,
        erp_amount: null,
        confidence_score: null,
        match_details: { note: "ISW transaction with no bank or invoice match" },
      });
    }

    // Orphan bank: credits with no ISW match
    for (const bank of bankTxns) {
      if (matchedBankIds.has(bank.id)) continue;
      matches.push({
        run_id: runId,
        isw_transaction_id: null,
        bank_transaction_id: bank.id,
        erp_invoice_id: null,
        match_status: "orphan_bank",
        isw_amount: null,
        bank_amount: bank.amount_kobo,
        erp_amount: null,
        confidence_score: null,
        match_details: { note: "Bank credit with no ISW match — mystery money" },
      });
    }

    // Orphan invoices: marked paid but no ISW record
    for (const erp of erpInvoices) {
      if (matchedErpIds.has(erp.id)) continue;
      if (erp.status === "paid") {
        matches.push({
          run_id: runId,
          isw_transaction_id: null,
          bank_transaction_id: null,
          erp_invoice_id: erp.id,
          match_status: "orphan_invoice",
          isw_amount: null,
          bank_amount: null,
          erp_amount: erp.amount_kobo,
          confidence_score: null,
          match_details: { note: "Invoice marked paid but no ISW/bank record" },
        });
      }
    }

    // 3. Insert all match records
    let insertedMatches: ReconciliationMatch[] = [];
    if (matches.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("reconciliation_matches")
        .insert(matches)
        .select();
      if (error) throw new Error(`Failed to insert matches: ${error.message}`);
      insertedMatches = data || [];
    }

    // 4. Tally results
    const matched = insertedMatches.filter((m) => m.match_status === "full_match").length;
    const mismatched = insertedMatches.filter((m) =>
      ["amount_mismatch", "isw_bank_match", "isw_erp_match"].includes(m.match_status)
    ).length;
    const unmatched = insertedMatches.filter((m) =>
      m.match_status.startsWith("orphan_") || m.match_status === "settlement_pending"
    ).length;

    // 5. Complete the run
    await supabaseAdmin
      .from("reconciliation_runs")
      .update({
        status: "completed",
        total_transactions: insertedMatches.length,
        matched,
        mismatched,
        unmatched,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    // 6. Auto-create disputes for mismatches and orphans
    const disputeableStatuses = ["amount_mismatch", "orphan_isw", "orphan_bank", "orphan_invoice", "isw_bank_match"];
    const disputeMatches = insertedMatches.filter((m) =>
      disputeableStatuses.includes(m.match_status)
    );

    for (const m of disputeMatches) {
      const reasonMap: Record<string, string> = {
        amount_mismatch: `Amount mismatch: ISW=${m.isw_amount}, Bank=${m.bank_amount}, ERP=${m.erp_amount}`,
        orphan_isw: `ISW payment of ₦${((m.isw_amount || 0) / 100).toLocaleString()} has no matching invoice or bank record`,
        orphan_bank: `Bank credit of ₦${((m.bank_amount || 0) / 100).toLocaleString()} has no matching ISW transaction`,
        orphan_invoice: `Invoice worth ₦${((m.erp_amount || 0) / 100).toLocaleString()} marked paid but no ISW/bank record`,
        isw_bank_match: `ISW payment of ₦${((m.isw_amount || 0) / 100).toLocaleString()} matched to bank but no invoice found`,
      };

      const priorityMap: Record<string, string> = {
        amount_mismatch: "high",
        orphan_isw: "medium",
        orphan_bank: "high",
        orphan_invoice: "critical",
        isw_bank_match: "medium",
      };

      await supabaseAdmin.from("disputes").insert({
        match_id: m.id,
        isw_transaction_id: m.isw_transaction_id,
        reason: reasonMap[m.match_status] || `Reconciliation issue: ${m.match_status}`,
        priority: priorityMap[m.match_status] || "medium",
      });
    }

    // 7. Audit log
    await appendToAuditChain({
      event_type: "reconciliation_completed",
      entity_type: "reconciliation_run",
      entity_id: runId,
      actor: "system",
      payload: { matched, mismatched, unmatched, total: insertedMatches.length, disputes_created: disputeMatches.length },
    });

    return {
      runId,
      total: insertedMatches.length,
      matched,
      mismatched,
      unmatched,
      matches: insertedMatches,
    };
  } catch (err) {
    await supabaseAdmin
      .from("reconciliation_runs")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", runId);
    throw err;
  }
}

/**
 * Run a quick realtime reconciliation for a single ISW transaction
 * (called after webhook receives a payment confirmation)
 */
export async function reconcileSingle(iswTxnId: string): Promise<ReconciliationMatch | null> {
  const { data: isw } = await supabaseAdmin
    .from("isw_transactions")
    .select("*")
    .eq("id", iswTxnId)
    .single();

  if (!isw) return null;

  // Try to match to an ERP invoice
  const invoiceHint = extractInvoiceIdFromTxnRef(isw.txn_ref);
  let erpMatch: ErpInvoice | null = null;

  if (invoiceHint) {
    const { data } = await supabaseAdmin
      .from("erp_invoices")
      .select("*")
      .ilike("invoice_number", `%${invoiceHint}%`)
      .limit(1);
    erpMatch = data?.[0] || null;
  }

  if (!erpMatch) {
    const { data } = await supabaseAdmin
      .from("erp_invoices")
      .select("*")
      .eq("amount_kobo", isw.amount_kobo)
      .in("status", ["sent", "overdue"])
      .limit(1);
    erpMatch = data?.[0] || null;
  }

  // Create a realtime run
  const { data: run } = await supabaseAdmin
    .from("reconciliation_runs")
    .insert({ run_type: "realtime", status: "completed", total_transactions: 1, matched: erpMatch ? 1 : 0, mismatched: 0, unmatched: erpMatch ? 0 : 1, completed_at: new Date().toISOString() })
    .select()
    .single();

  const matchStatus: MatchStatus = erpMatch
    ? isw.amount_kobo === erpMatch.amount_kobo
      ? "isw_erp_match"
      : "amount_mismatch"
    : "orphan_isw";

  const { data: match } = await supabaseAdmin
    .from("reconciliation_matches")
    .insert({
      run_id: run!.id,
      isw_transaction_id: isw.id,
      bank_transaction_id: null,
      erp_invoice_id: erpMatch?.id || null,
      match_status: matchStatus,
      isw_amount: isw.amount_kobo,
      bank_amount: null,
      erp_amount: erpMatch?.amount_kobo || null,
      confidence_score: erpMatch ? 0.7 : null,
      match_details: { realtime: true },
    })
    .select()
    .single();

  await appendToAuditChain({
    event_type: "realtime_reconciliation",
    entity_type: "reconciliation_match",
    entity_id: match!.id,
    actor: "system",
    payload: { match_status: matchStatus, isw_txn_ref: isw.txn_ref },
  });

  return match;
}
