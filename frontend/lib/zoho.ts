/**
 * Zoho Books API helpers
 * Docs: https://www.zoho.com/books/api/v3/introduction/
 *
 * In production, this pulls invoices and payment records from Zoho Books.
 * For the hackathon, we fall back to seeded data in the erp_invoices table.
 */

const ZOHO_BOOKS_BASE = "https://www.zohoapis.com/books/v3";
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID || "";
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID || "";
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || "";
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN || "";

let cachedAccessToken: string | null = null;
let tokenExpiry = 0;

/**
 * Get a valid Zoho access token (refreshes automatically)
 */
async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiry) {
    return cachedAccessToken;
  }

  if (!ZOHO_CLIENT_ID || !ZOHO_REFRESH_TOKEN) {
    throw new Error("Zoho credentials not configured");
  }

  const res = await fetch(
    `https://accounts.zoho.com/oauth/v2/token?` +
      `refresh_token=${ZOHO_REFRESH_TOKEN}` +
      `&client_id=${ZOHO_CLIENT_ID}` +
      `&client_secret=${ZOHO_CLIENT_SECRET}` +
      `&grant_type=refresh_token`,
    { method: "POST" }
  );

  const data = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedAccessToken!;
}

interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_name: string;
  email: string;
  total: number;
  status: string;
  due_date: string;
  date: string;
}

/**
 * Fetch invoices from Zoho Books
 */
export async function fetchInvoices(
  status?: string
): Promise<ZohoInvoice[]> {
  if (!ZOHO_CLIENT_ID) {
    console.warn("Zoho credentials not configured — using seeded data");
    return [];
  }

  const token = await getAccessToken();
  const params = new URLSearchParams({ organization_id: ZOHO_ORG_ID });
  if (status) params.set("status", status);

  const res = await fetch(`${ZOHO_BOOKS_BASE}/invoices?${params}`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Zoho API error: ${res.status}`);
  }

  const data = await res.json();
  return data.invoices || [];
}

/**
 * Convert Zoho invoice to our erp_invoices format
 */
export function zohoToErpInvoice(invoice: ZohoInvoice) {
  return {
    zoho_invoice_id: invoice.invoice_id,
    invoice_number: invoice.invoice_number,
    customer_name: invoice.customer_name,
    customer_email: invoice.email,
    amount_kobo: Math.round(invoice.total * 100),
    status: mapZohoStatus(invoice.status),
    due_date: invoice.due_date,
    raw_data: invoice as unknown as Record<string, unknown>,
  };
}

function mapZohoStatus(zohoStatus: string): string {
  const map: Record<string, string> = {
    draft: "draft",
    sent: "sent",
    paid: "paid",
    overdue: "overdue",
    void: "void",
    partially_paid: "sent",
  };
  return map[zohoStatus] || "sent";
}
