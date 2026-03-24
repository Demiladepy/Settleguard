import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { appendToAuditChain } from "@/lib/audit-chain";

/**
 * GET  /api/disputes — List disputes
 * POST /api/disputes — Create a new dispute
 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("disputes")
    .select("*, reconciliation_matches(*), isw_transactions:isw_transaction_id(*)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ disputes: data });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { match_id, isw_transaction_id, reason, priority } = body;

    if (!reason) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    const { data: dispute, error } = await supabaseAdmin
      .from("disputes")
      .insert({
        match_id: match_id || null,
        isw_transaction_id: isw_transaction_id || null,
        reason,
        priority: priority || "medium",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await appendToAuditChain({
      event_type: "dispute_created",
      entity_type: "dispute",
      entity_id: dispute.id,
      actor: "user",
      payload: { reason, priority: priority || "medium" },
    });

    return NextResponse.json({ dispute }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create dispute" },
      { status: 500 }
    );
  }
}
