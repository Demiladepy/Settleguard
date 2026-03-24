<div align="center">

# SettleGuard

**Multi-Source AI Reconciliation Engine**

Three-way automated payment reconciliation across Interswitch, bank accounts, and ERP systems — powered by an AI dispute resolution agent.

`Enyata x Interswitch Buildathon 2026 — B2B Edition`

</div>

---

## Problem

Nigerian businesses processed over **one quadrillion naira** in electronic payments last year. Every transaction must be reconciled across three systems that speak different languages:

| Source | What it shows | The problem |
|--------|--------------|-------------|
| **Interswitch** (gateway) | Individual customer payments | Settles in bulk — 1 bank deposit = 50+ transactions |
| **Bank account** | Lump-sum credits with cryptic narrations | `"ISW SETTLEMENT/MX6072/260322/BATCH7721"` |
| **Zoho Books** (ERP) | Individual invoices with customer names | No link to gateway transaction refs |

Finance teams spend **3-5 days every month** in spreadsheets trying to match these. Interswitch alone lost **₦11.45 billion** to chargeback fraud in 2024 because this process is broken.

SettleGuard replaces that with a single API call.

---

## How It Works

```
┌──────────────┐     ┌─────────────────────┐     ┌──────────────┐
│  INTERSWITCH  │     │   RECONCILIATION     │     │  BANK (MONO) │
│   Gateway     │────▶│      ENGINE          │◀────│   Account    │
│  (payments)   │     │                     │     │  (deposits)  │
└──────────────┘     │  Three-way matching  │     └──────────────┘
                     │  Batch decomposition │
                     │  Orphan detection    │
                     └─────────┬───────────┘
                               │
                     ┌─────────▼───────────┐     ┌──────────────┐
                     │    AI DISPUTE        │     │  ZOHO BOOKS  │
                     │     AGENT            │◀────│    (ERP)     │
                     │  (Claude tool_use)   │     │  (invoices)  │
                     └─────────┬───────────┘     └──────────────┘
                               │
                     ┌─────────▼───────────┐
                     │  AUDIT CHAIN         │
                     │  (SHA-256 linked)    │
                     └─────────────────────┘
```

### 1. Three-Way Matching

The reconciliation engine runs a four-step algorithm:

1. **ISW ↔ ERP match** — Match gateway transactions to invoices by amount, customer email, and transaction reference
2. **ISW ↔ Bank match** — Match gateway transactions (or settlement batches) to bank credits by amount, narration parsing, and date proximity
3. **Three-way reconciliation** — If all three sources agree on amount → `full_match`. If any two differ → `amount_mismatch` → dispute created
4. **Orphan detection** — Bank credits with no ISW match, invoices marked paid with no gateway record, ISW transactions with no invoice

### 2. Settlement Decomposition

Interswitch settles multiple transactions as one lump sum. A single bank deposit of **₦1,847,500** might contain 23 individual customer payments.

The decomposer:
- Extracts the batch ID from the bank narration
- Pulls all ISW transactions in that batch
- Matches each to an invoice
- Falls back to a greedy subset-sum algorithm when batch IDs aren't available
- Flags orphans and amount mismatches

### 3. AI Dispute Agent

When the engine detects a discrepancy, an AI agent (Claude with `tool_use`) investigates autonomously. The agent has access to 6 tools:

| Tool | What it does |
|------|-------------|
| `query_isw_transaction` | Look up gateway transactions by ref or batch |
| `query_bank_transactions` | Search bank records by amount, date, or narration |
| `query_erp_invoices` | Search invoices by customer, amount, or status |
| `get_customer_dispute_history` | Check for repeat dispute patterns |
| `calculate_settlement_breakdown` | Decompose a bulk settlement |
| `execute_refund` | Issue refund (only if confidence > 0.9) |

The agent runs up to 10 investigation steps, queries all three data sources, and outputs a recommendation:

- **REFUND** — Clear evidence of wrong charge (confidence > 0.85)
- **REJECT** — Charge is valid
- **ESCALATE** — Ambiguous, needs human review
- **WAIT** — Settlement likely pending (1-3 business days)
- **AUTO_RESOLVED** — Found the match, was a timing/format issue

### 4. Tamper-Evident Audit Chain

Every operation is logged to a SHA-256 hash-linked chain. Each entry's hash includes the previous entry's hash. If any record is modified after logging, chain verification detects it immediately.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS | Dashboard, demo payment page, realtime UI |
| Backend | Next.js API Routes | Webhooks, reconciliation engine, agent orchestration |
| Database | Supabase (PostgreSQL + Realtime) | Persistent storage with live subscriptions |
| Bank Data | Mono Connect API | Open banking — pull bank statements from 30+ Nigerian banks |
| ERP Data | Zoho Books API | Pull invoices and payment records |
| AI Agent | Anthropic Claude API (`claude-sonnet-4-20250514`) | Multi-tool dispute investigation |
| Payments | Interswitch Web Checkout + Transaction Requery | The gateway being reconciled |
| Privacy | SHA-256 commitment scheme | Multi-tenant data isolation |

---

## Project Structure

```
frontend/
├── app/
│   ├── page.tsx                              # Dashboard (realtime stats + transaction feed)
│   ├── layout.tsx                            # Root layout (SettleGuard branding)
│   ├── demo/page.tsx                         # Payment demo (ISW inline checkout)
│   ├── reconciliation/page.tsx               # Three-column matrix + settlement decomposition
│   ├── disputes/page.tsx                     # AI dispute investigation panel
│   ├── audit/page.tsx                        # Audit chain viewer + integrity verifier
│   └── api/
│       ├── webhooks/interswitch/route.ts     # ISW callback → requery → store → reconcile
│       ├── sources/
│       │   ├── sync-bank/route.ts            # Pull from Mono (or seeded data)
│       │   └── sync-erp/route.ts             # Pull from Zoho Books (or seeded data)
│       ├── reconcile/
│       │   ├── route.ts                      # Full three-way reconciliation
│       │   ├── batch/route.ts                # Cron/batch reconciliation
│       │   └── decompose/route.ts            # Settlement decomposition
│       ├── disputes/
│       │   ├── route.ts                      # List/create disputes
│       │   └── investigate/route.ts          # AI agent investigation
│       ├── audit/
│       │   ├── route.ts                      # Audit chain entries
│       │   └── verify/route.ts               # Chain integrity verification
│       ├── invoices/route.ts                 # Demo invoice CRUD
│       └── seed/route.ts                     # Seed demo data
├── lib/
│   ├── supabase.ts                           # Supabase client + all TypeScript interfaces
│   ├── interswitch.ts                        # ISW requery, txn ref generation, narration parsing
│   ├── mono.ts                               # Mono Connect API (bank statement pull)
│   ├── zoho.ts                               # Zoho Books API (invoice pull + OAuth refresh)
│   ├── reconciliation-engine.ts              # Three-way matching algorithm
│   ├── settlement-decomposer.ts              # Batch decomposition + subset-sum fallback
│   ├── ai-agent.ts                           # Claude tool_use agent loop (6 tools)
│   ├── audit-chain.ts                        # SHA-256 hash chain (append + verify)
│   └── privacy.ts                            # Commitment-based private reconciliation
├── components/
│   ├── Navbar.tsx                             # App navigation
│   ├── Dashboard.tsx                          # Main dashboard (stats + feed + integrity)
│   ├── ReconciliationMatrix.tsx               # Three-column ISW/Bank/ERP view
│   ├── DisputeInvestigation.tsx               # Dispute list + AI investigation trigger
│   ├── AuditChainHealth.tsx                   # Chain viewer + verification
│   ├── PaymentDemo.tsx                        # ISW test payment UI
│   ├── SettlementBreakdown.tsx                # Legacy settlement view
│   ├── dashboard/
│   │   ├── TransactionFeed.tsx                # Realtime ISW transaction feed
│   │   ├── StatsCards.tsx                     # Live stats (matched, pending, disputes)
│   │   └── MatchStatusBadge.tsx               # Color-coded status badges
│   ├── disputes/
│   │   ├── DisputeCard.tsx                    # Single dispute with AI results
│   │   └── InvestigationTimeline.tsx          # Step-by-step agent tool call trace
│   ├── settlement/
│   │   └── SettlementBreakdown.tsx            # Decompose button → N transaction cards
│   └── audit/
│       └── IntegrityIndicator.tsx             # Green/red shield verification widget
└── .env.local                                 # All credentials (see below)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- [Anthropic API key](https://console.anthropic.com) for the AI agent

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure environment

Copy `.env.local` and fill in your credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Interswitch (sandbox credentials included)
ISW_MERCHANT_CODE=MX6072
ISW_PAY_ITEM_ID=9405967
ISW_CLIENT_ID=IKIAB23A4E2756605C1ABC33CE3C287E27267F660D61
ISW_SECRET=secret
ISW_BASE_URL=https://qa.interswitchng.com

# Mono (optional — falls back to seeded data)
MONO_SECRET_KEY=your-mono-secret
MONO_PUBLIC_KEY=your-mono-public

# Zoho Books (optional — falls back to seeded data)
ZOHO_CLIENT_ID=your-zoho-client-id
ZOHO_CLIENT_SECRET=your-zoho-client-secret
ZOHO_ORG_ID=your-zoho-org-id
ZOHO_REFRESH_TOKEN=your-zoho-refresh-token

# AI Agent
ANTHROPIC_API_KEY=your-anthropic-key
```

### 3. Set up the database

Run the SQL schema in your Supabase SQL editor. The schema creates 7 tables:

- `isw_transactions` — Interswitch payment records
- `bank_transactions` — Bank account credits/debits (via Mono)
- `erp_invoices` — Zoho Books invoices
- `reconciliation_runs` — Batch reconciliation runs
- `reconciliation_matches` — Individual match results with status
- `disputes` — Disputes with AI investigation data
- `audit_chain` — Tamper-evident hash-linked audit log

Enable Supabase Realtime on: `isw_transactions`, `reconciliation_matches`, `disputes`, `reconciliation_runs`.

### 4. Seed demo data

```bash
npm run dev
# Then in another terminal:
curl -X POST http://localhost:3000/api/seed
```

This creates 10 invoices, 11 ISW transactions (across 2 settlement batches + 1 orphan + 1 failed), and 4 bank transactions with realistic Nigerian business data.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Seed Demo Data** → **Run Reconciliation** to see the engine in action.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/seed` | Seed demo data (invoices, ISW txns, bank txns) |
| `POST` | `/api/webhooks/interswitch` | ISW payment callback → requery → reconcile |
| `POST` | `/api/reconcile` | Run full three-way reconciliation |
| `GET`  | `/api/reconcile` | Get recent runs + matches + stats |
| `POST` | `/api/reconcile/batch` | Batch/cron reconciliation |
| `POST` | `/api/reconcile/decompose` | Decompose settlement by `batch_id` or `bank_transaction_id` |
| `GET`  | `/api/disputes` | List all disputes |
| `POST` | `/api/disputes` | Create a new dispute |
| `POST` | `/api/disputes/investigate` | Run AI agent investigation on a dispute |
| `GET`  | `/api/invoices` | List invoices |
| `POST` | `/api/invoices` | Create invoice |
| `GET`  | `/api/audit` | Get audit chain entries |
| `POST` | `/api/audit/verify` | Verify full chain integrity |
| `POST` | `/api/sources/sync-bank` | Sync bank transactions from Mono |
| `POST` | `/api/sources/sync-erp` | Sync invoices from Zoho Books |

---

## Database Schema

```sql
-- 7 tables, 10 indexes, 3 realtime-enabled tables
-- See full schema in Supabase SQL editor

-- Key relationships:
-- isw_transactions.settlement_batch_id → groups into settlement batches
-- reconciliation_matches → links isw_transaction_id, bank_transaction_id, erp_invoice_id
-- disputes.match_id → references reconciliation_matches
-- audit_chain.prev_hash → links to previous entry's hash (tamper detection)
```

---

## Demo Flow

### Happy Path
1. Pay an invoice on `/demo` using ISW test card (`5060990580000217499`, exp `03/50`, cvv `111`, pin `1111`)
2. Dashboard updates in realtime — ISW transaction appears, reconciliation fires, match found
3. Bank settlement pending (expected in 1-3 days)

### Settlement Decomposition
1. Go to `/reconciliation`
2. Click a bank settlement deposit (e.g., ₦967,500)
3. Click **Decompose Settlement** — individual transactions fan out
4. 22 match to invoices, 1 orphan flagged in red

### AI Investigation
1. Go to `/disputes`
2. Click **Investigate** on any dispute
3. Watch the AI agent query ISW, bank, and ERP data in real time
4. Agent returns recommendation with confidence score and full tool call trace

### Tamper Detection
1. Go to `/audit`
2. Click **Verify Chain Integrity** — green shield if intact
3. Manually alter a record in Supabase → re-verify → red alert

---

## Competitive Positioning

| Company | Valuation | Gap SettleGuard fills |
|---------|-----------|----------------------|
| Modern Treasury | $2B (YC W18) | No AI dispute resolution. No African payment rails. |
| Stripe Radar | — | No NGN support. Can't reconcile ISW settlements. |
| Zone (Nigeria) | $8.5M raised | Blockchain overhead. No AI agent. |
| Trovata | — | US/Europe only. No African banks. |

**SettleGuard's edges:**
1. Built natively for African payment infrastructure (Interswitch, NIBSS, Mono)
2. AI agent that autonomously investigates disputes end-to-end
3. Settlement decomposition (bulk bank deposit → individual matched transactions)
4. Cryptographic commitment-based multi-tenant data isolation

---

## Team

**Enyata** — Building for the Interswitch Buildathon 2026 (B2B Edition)

---

## License

MIT
