import crypto from "crypto";

const ISW_BASE_URL = process.env.ISW_BASE_URL || "https://qa.interswitchng.com";
const ISW_MERCHANT_CODE = process.env.ISW_MERCHANT_CODE || "MX6072";
const ISW_CLIENT_ID = process.env.ISW_CLIENT_ID || "";
const ISW_SECRET = process.env.ISW_SECRET || "";

export interface IswVerifyResponse {
  ResponseCode: string;
  ResponseDescription: string;
  Amount: number;
  MerchantReference: string;
  PaymentReference: string;
  TransactionDate: string;
  CardNumber?: string;
  RetrievalReferenceNumber?: string;
  [key: string]: unknown;
}

/**
 * Get ISW access token via OAuth2 client_credentials grant.
 * Token is used for server-to-server API calls (requery, refund).
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getIswAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${ISW_CLIENT_ID}:${ISW_SECRET}`).toString("base64");

  const res = await fetch(`${ISW_BASE_URL}/passport/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn("ISW OAuth failed, falling back to unauthenticated:", text);
    return "";
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000 - 60000,
  };
  return cachedToken.token;
}

/**
 * Generate ISW signature hash for authenticated requests.
 * Used for endpoints that require InterswitchAuth instead of Bearer token.
 */
export function generateIswSignature(resourceUrl: string, httpMethod: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const signatureCipher = `${httpMethod}&${encodeURIComponent(resourceUrl)}&${timestamp}&${nonce}&${ISW_CLIENT_ID}&${ISW_SECRET}`;
  const signature = crypto.createHash("sha512").update(signatureCipher).digest("base64");
  return JSON.stringify({ Timestamp: timestamp, Nonce: nonce, SignatureMethod: "SHA512", Signature: signature });
}

/**
 * Verify a transaction with Interswitch (server-side requery).
 * Uses OAuth2 bearer token. Falls back to unauthenticated for sandbox.
 */
export async function verifyIswTransaction(
  txnRef: string,
  expectedAmountKobo: number
): Promise<IswVerifyResponse> {
  const url =
    `${ISW_BASE_URL}/collections/api/v1/gettransaction.json` +
    `?merchantcode=${ISW_MERCHANT_CODE}` +
    `&transactionreference=${encodeURIComponent(txnRef)}` +
    `&amount=${expectedAmountKobo}`;

  const token = await getIswAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`ISW requery failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Request a refund via Interswitch.
 * Only called by the AI agent when confidence > 0.9.
 */
export async function requestIswRefund(
  txnRef: string,
  amountKobo: number,
  reason: string
): Promise<{ success: boolean; response: Record<string, unknown> }> {
  const token = await getIswAccessToken();
  const url = `${ISW_BASE_URL}/collections/api/v1/refund`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      transactionReference: txnRef,
      refundAmount: amountKobo,
      merchantCode: ISW_MERCHANT_CODE,
      reason,
    }),
  });

  const data = await res.json().catch(() => ({}));
  return { success: res.ok, response: data };
}

/**
 * Search transactions on Interswitch network using the Transaction Search API.
 * Useful for reconciliation — pull transaction history by date range, status, etc.
 */
export interface IswTransactionSearchParams {
  merchantCode?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  pageNumber?: number;
  pageSize?: number;
  transactionRef?: string;
  paymentRef?: string;
}

export interface IswTransactionRecord {
  transactionReference: string;
  paymentReference: string;
  amount: number;
  responseCode: string;
  responseDescription: string;
  transactionDate: string;
  channel: string;
  cardNumber?: string;
  settlementStatus?: string;
  [key: string]: unknown;
}

export async function searchIswTransactions(
  params: IswTransactionSearchParams = {}
): Promise<{ transactions: IswTransactionRecord[]; totalCount: number }> {
  const token = await getIswAccessToken();
  const merchantCode = params.merchantCode || ISW_MERCHANT_CODE;

  const queryParams = new URLSearchParams({
    merchantcode: merchantCode,
    ...(params.startDate && { startdate: params.startDate }),
    ...(params.endDate && { enddate: params.endDate }),
    ...(params.pageNumber && { pagenumber: params.pageNumber.toString() }),
    ...(params.pageSize && { pagesize: params.pageSize.toString() }),
    ...(params.transactionRef && { transactionreference: params.transactionRef }),
    ...(params.paymentRef && { paymentreference: params.paymentRef }),
  });

  const url = `${ISW_BASE_URL}/collections/api/v1/transactions?${queryParams}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    console.warn(`ISW Transaction Search failed: ${res.status}`);
    return { transactions: [], totalCount: 0 };
  }

  const data = await res.json();
  return {
    transactions: data.transactions || data.Transactions || [],
    totalCount: data.totalCount || data.TotalCount || 0,
  };
}

/**
 * Pull recent ISW transactions and sync to Supabase for reconciliation.
 * This bridges the gap between live ISW data and our local reconciliation engine.
 */
export async function pullIswTransactionsForReconciliation(
  startDate: string,
  endDate: string
): Promise<IswTransactionRecord[]> {
  const allTransactions: IswTransactionRecord[] = [];
  let page = 1;
  const pageSize = 50;

  while (true) {
    const result = await searchIswTransactions({
      startDate,
      endDate,
      pageNumber: page,
      pageSize,
    });

    allTransactions.push(...result.transactions);

    if (allTransactions.length >= result.totalCount || result.transactions.length < pageSize) {
      break;
    }
    page++;
  }

  return allTransactions;
}

/**
 * Check if a transaction response code indicates success
 */
export function isSuccessful(responseCode: string): boolean {
  return responseCode === "00";
}

/**
 * Format kobo to Naira string
 */
export function koboToNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

/**
 * Generate a SettleGuard transaction reference
 */
export function generateTxnRef(invoiceId: string): string {
  return `SG-${invoiceId}-${Date.now()}`;
}

/**
 * Parse ISW settlement batch ID from bank narration
 * e.g. "ISW SETTLEMENT/MX6072/250324/BATCH7721" → "BATCH7721"
 */
export function parseBatchIdFromNarration(narration: string): string | null {
  const match = narration.match(/BATCH(\w+)/i);
  return match ? match[0] : null;
}

/**
 * Parse merchant code from bank narration
 */
export function parseMerchantCodeFromNarration(narration: string): string | null {
  const match = narration.match(/\b(MX\d+)\b/i);
  return match ? match[1] : null;
}
