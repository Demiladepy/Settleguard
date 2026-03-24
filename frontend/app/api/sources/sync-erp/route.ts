import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchInvoices, zohoToErpInvoice } from "@/lib/zoho";

/**
 * Sync invoices from Zoho Books (or acknowledge seeded data).
 * POST /api/sources/sync-erp
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { status } = body;

    // Try pulling from Zoho
    const zohoInvoices = await fetchInvoices(status);

    if (zohoInvoices.length === 0) {
      // Zoho not configured — use seeded data
      const { count } = await supabaseAdmin
        .from("erp_invoices")
        .select("*", { count: "exact", head: true });

      return NextResponse.json({
        source: "seeded_data",
        total: count || 0,
        message: "Zoho not configured. Using seeded invoice data.",
      });
    }

    const records = zohoInvoices.map(zohoToErpInvoice);

    const { data, error } = await supabaseAdmin
      .from("erp_invoices")
      .upsert(records, { onConflict: "zoho_invoice_id" })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ synced: data?.length || 0, source: "zoho_books" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("erp_invoices")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoices: data });
}
