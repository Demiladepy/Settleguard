import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client-side Supabase client (uses anon key, respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client (bypasses RLS — use only in API routes)
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey
);

// Database types
export interface IswTransaction {
  id: string;
  txn_ref: string;
  merchant_code: string;
  response_code: string | null;
  response_desc: string | null;
  amount_kobo: number;
  payment_reference: string | null;
  card_number_masked: string | null;
  transaction_date: string | null;
  settlement_batch_id: string | null;
  raw_response: Record<string, unknown> | null;
  created_at: string;
}

export interface BankTransaction {
  id: string;
  mono_id: string | null;
  bank_name: string | null;
  account_number_masked: string | null;
  narration: string;
  amount_kobo: number;
  transaction_type: "credit" | "debit";
  transaction_date: string | null;
  balance_after: number | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface ErpInvoice {
  id: string;
  zoho_invoice_id: string | null;
  invoice_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  amount_kobo: number;
  status: "draft" | "sent" | "paid" | "overdue" | "void";
  due_date: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface ReconciliationRun {
  id: string;
  run_type: "realtime" | "batch_daily" | "manual";
  status: "running" | "completed" | "failed";
  total_transactions: number;
  matched: number;
  mismatched: number;
  unmatched: number;
  started_at: string;
  completed_at: string | null;
}

export type MatchStatus =
  | "full_match"
  | "isw_bank_match"
  | "isw_erp_match"
  | "amount_mismatch"
  | "orphan_isw"
  | "orphan_bank"
  | "orphan_invoice"
  | "settlement_pending";

export interface ReconciliationMatch {
  id: string;
  run_id: string;
  isw_transaction_id: string | null;
  bank_transaction_id: string | null;
  erp_invoice_id: string | null;
  match_status: MatchStatus;
  isw_amount: number | null;
  bank_amount: number | null;
  erp_amount: number | null;
  confidence_score: number | null;
  match_details: Record<string, unknown> | null;
  created_at: string;
}

export interface Dispute {
  id: string;
  match_id: string | null;
  isw_transaction_id: string | null;
  reason: string;
  priority: "low" | "medium" | "high" | "critical";
  ai_investigation: Record<string, unknown> | null;
  ai_recommendation: "refund" | "reject" | "escalate" | "wait" | "auto_resolved" | null;
  ai_confidence: number | null;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
  created_at: string;
}
