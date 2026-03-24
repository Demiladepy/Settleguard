import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { investigateDispute } from "@/lib/ai-agent";
import { appendToAuditChain } from "@/lib/audit-chain";

/**
 * POST /api/disputes/investigate
 * Run the AI agent to investigate a dispute.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dispute_id } = body;

    if (!dispute_id) {
      return NextResponse.json({ error: "dispute_id required" }, { status: 400 });
    }

    // Load dispute + related data
    const { data: dispute, error } = await supabaseAdmin
      .from("disputes")
      .select("*")
      .eq("id", dispute_id)
      .single();

    if (error || !dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Get related ISW transaction for context
    let context: Record<string, unknown> = {};
    if (dispute.isw_transaction_id) {
      const { data: isw } = await supabaseAdmin
        .from("isw_transactions")
        .select("*")
        .eq("id", dispute.isw_transaction_id)
        .single();

      if (isw) {
        context = {
          txn_ref: isw.txn_ref,
          amount_kobo: isw.amount_kobo,
          batch_id: isw.settlement_batch_id,
          customer_email: (isw.raw_response as Record<string, unknown>)?.cust_email,
        };
      }
    }

    // Get match context
    if (dispute.match_id) {
      const { data: match } = await supabaseAdmin
        .from("reconciliation_matches")
        .select("*")
        .eq("id", dispute.match_id)
        .single();

      if (match) {
        context.match_status = match.match_status;
      }
    }

    // Run AI investigation
    const result = await investigateDispute(dispute.reason, context as {
      txn_ref?: string;
      customer_email?: string;
      amount_kobo?: number;
      batch_id?: string;
      match_status?: string;
    });

    // Update dispute with AI findings
    await supabaseAdmin
      .from("disputes")
      .update({
        ai_investigation: {
          tool_calls: result.toolCalls,
          evidence: result.evidence,
        },
        ai_recommendation: result.recommendation.toLowerCase(),
        ai_confidence: result.confidence,
      })
      .eq("id", dispute_id);

    // If auto-resolved, mark it
    if (result.recommendation === "AUTO_RESOLVED" && result.confidence > 0.8) {
      await supabaseAdmin
        .from("disputes")
        .update({
          resolution: result.summary,
          resolved_by: "ai_agent",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", dispute_id);
    }

    await appendToAuditChain({
      event_type: "ai_investigation_completed",
      entity_type: "dispute",
      entity_id: dispute_id,
      actor: "ai_agent",
      payload: {
        recommendation: result.recommendation,
        confidence: result.confidence,
        tool_calls_count: result.toolCalls.length,
      },
    });

    return NextResponse.json({
      dispute_id,
      recommendation: result.recommendation,
      confidence: result.confidence,
      summary: result.summary,
      evidence: result.evidence,
      tool_calls: result.toolCalls,
    });
  } catch (err) {
    console.error("AI investigation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Investigation failed" },
      { status: 500 }
    );
  }
}
