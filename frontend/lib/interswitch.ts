const ISW_BASE_URL = process.env.ISW_BASE_URL || "https://qa.interswitchng.com";
const ISW_MERCHANT_CODE = process.env.ISW_MERCHANT_CODE || "MX6072";

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
 * Verify a transaction with Interswitch (server-side requery)
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

  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`ISW requery failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
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
