-- ============================================================
-- SettleGuard v2 — Full Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- SOURCES: The three systems we reconcile between

-- What Interswitch says happened
CREATE TABLE IF NOT EXISTS isw_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  txn_ref TEXT UNIQUE NOT NULL,
  merchant_code TEXT NOT NULL,
  response_code TEXT,
  response_desc TEXT,
  amount_kobo BIGINT NOT NULL,
  payment_reference TEXT,
  card_number_masked TEXT,
  transaction_date TIMESTAMPTZ,
  settlement_batch_id TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- What the bank account shows (via Mono)
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mono_id TEXT UNIQUE,
  bank_name TEXT,
  account_number_masked TEXT,
  narration TEXT NOT NULL,
  amount_kobo BIGINT NOT NULL,
  transaction_type TEXT CHECK (transaction_type IN ('credit', 'debit')),
  transaction_date TIMESTAMPTZ,
  balance_after BIGINT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- What the ERP/accounting system expects (via Zoho Books)
CREATE TABLE IF NOT EXISTS erp_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  zoho_invoice_id TEXT UNIQUE,
  invoice_number TEXT UNIQUE,
  customer_name TEXT,
  customer_email TEXT,
  amount_kobo BIGINT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('draft','sent','paid','overdue','void')),
  due_date DATE,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RECONCILIATION ENGINE
-- ============================================================

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type TEXT NOT NULL CHECK (run_type IN ('realtime', 'batch_daily', 'manual')),
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  total_transactions INT DEFAULT 0,
  matched INT DEFAULT 0,
  mismatched INT DEFAULT 0,
  unmatched INT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reconciliation_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES reconciliation_runs(id),
  isw_transaction_id UUID REFERENCES isw_transactions(id),
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  erp_invoice_id UUID REFERENCES erp_invoices(id),
  match_status TEXT NOT NULL CHECK (match_status IN (
    'full_match',
    'isw_bank_match',
    'isw_erp_match',
    'amount_mismatch',
    'orphan_isw',
    'orphan_bank',
    'orphan_invoice',
    'settlement_pending',
    'duplicate_detected'
  )),
  isw_amount BIGINT,
  bank_amount BIGINT,
  erp_amount BIGINT,
  confidence_score FLOAT,
  match_details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AI DISPUTE AGENT
-- ============================================================

CREATE TABLE IF NOT EXISTS disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES reconciliation_matches(id),
  isw_transaction_id UUID REFERENCES isw_transactions(id),
  reason TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  ai_investigation JSONB,
  ai_recommendation TEXT CHECK (ai_recommendation IN ('refund','reject','escalate','wait','auto_resolved')),
  ai_confidence FLOAT,
  resolution TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TAMPER-EVIDENT AUDIT CHAIN
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_chain (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  actor TEXT NOT NULL,
  payload JSONB NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_isw_txn_ref ON isw_transactions(txn_ref);
CREATE INDEX IF NOT EXISTS idx_isw_settlement ON isw_transactions(settlement_batch_id);
CREATE INDEX IF NOT EXISTS idx_bank_narration ON bank_transactions USING gin(to_tsvector('english', narration));
CREATE INDEX IF NOT EXISTS idx_bank_amount ON bank_transactions(amount_kobo);
CREATE INDEX IF NOT EXISTS idx_erp_invoice_num ON erp_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_matches_status ON reconciliation_matches(match_status);
CREATE INDEX IF NOT EXISTS idx_disputes_priority ON disputes(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_chain(entity_type, entity_id);

-- ============================================================
-- ENABLE REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE isw_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE reconciliation_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE disputes;
ALTER PUBLICATION supabase_realtime ADD TABLE reconciliation_runs;
