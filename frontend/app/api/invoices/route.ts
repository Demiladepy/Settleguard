import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Demo invoice CRUD — for the payment demo page.
 * GET  /api/invoices — List invoices
 * POST /api/invoices — Create invoice
 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("erp_invoices")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoices: data });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoice_number, customer_name, customer_email, amount_kobo, due_date } = body;

    if (!invoice_number || !amount_kobo) {
      return NextResponse.json(
        { error: "invoice_number and amount_kobo required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("erp_invoices")
      .insert({
        invoice_number,
        customer_name: customer_name || null,
        customer_email: customer_email || null,
        amount_kobo,
        due_date: due_date || null,
        status: "sent",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ invoice: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create invoice" },
      { status: 500 }
    );
  }
}
