/**
 * Mono Connect API helpers
 * Docs: https://docs.mono.co
 *
 * In production, this pulls real bank statements via Mono's open banking API.
 * For the hackathon, we fall back to seeded data in the bank_transactions table.
 */

const MONO_BASE_URL = "https://api.withmono.com/v2";
const MONO_SECRET = process.env.MONO_SECRET_KEY || "";

interface MonoTransaction {
  _id: string;
  amount: number; // in major currency units (Naira)
  narration: string;
  type: "credit" | "debit";
  date: string;
  balance: number;
  category?: string;
}

interface MonoTransactionsResponse {
  data: MonoTransaction[];
  paging: {
    total: number;
    page: number;
    previous: string | null;
    next: string | null;
  };
}

/**
 * Fetch transactions from a connected bank account via Mono
 */
export async function fetchBankTransactions(
  accountId: string,
  startDate?: string,
  endDate?: string
): Promise<MonoTransaction[]> {
  if (!MONO_SECRET) {
    console.warn("Mono secret key not configured — using seeded data");
    return [];
  }

  const params = new URLSearchParams();
  if (startDate) params.set("start", startDate);
  if (endDate) params.set("end", endDate);
  params.set("paginate", "false");

  const res = await fetch(
    `${MONO_BASE_URL}/accounts/${accountId}/transactions?${params}`,
    {
      headers: {
        "mono-sec-key": MONO_SECRET,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Mono API error: ${res.status} ${res.statusText}`);
  }

  const data: MonoTransactionsResponse = await res.json();
  return data.data;
}

/**
 * Convert Mono transaction to our bank_transactions format
 */
export function monoToBankTransaction(mono: MonoTransaction) {
  return {
    mono_id: mono._id,
    narration: mono.narration,
    amount_kobo: Math.round(mono.amount * 100),
    transaction_type: mono.type,
    transaction_date: mono.date,
    balance_after: Math.round(mono.balance * 100),
    raw_data: mono as unknown as Record<string, unknown>,
  };
}

/**
 * Exchange Mono Connect auth code for an account ID.
 * Called after the user links their bank via the Mono Connect widget.
 */
export async function exchangeMonoCode(code: string): Promise<{ id: string }> {
  if (!MONO_SECRET) throw new Error("Mono secret key not configured");

  const res = await fetch(`${MONO_BASE_URL}/accounts/auth`, {
    method: "POST",
    headers: {
      "mono-sec-key": MONO_SECRET,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mono auth exchange failed: ${res.status} ${err}`);
  }

  return res.json();
}

/**
 * Get account identity/details from Mono
 */
export async function getAccountInfo(accountId: string) {
  if (!MONO_SECRET) return null;

  const res = await fetch(`${MONO_BASE_URL}/accounts/${accountId}`, {
    headers: {
      "mono-sec-key": MONO_SECRET,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) return null;
  return res.json();
}
