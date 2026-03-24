import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { runReconciliation } from "@/lib/reconciliation-engine";

/**
 * POST /api/reconcile — Run full three-way reconciliation
 * GET  /api/reconcile — Get recent reconciliation runs + matches
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const runType = body.run_type || "manual";
    const result = await runReconciliation(runType);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Reconciliation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reconciliation failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Latest runs
    const { data: runs } = await supabaseAdmin
      .from("reconciliation_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);

    // Latest matches
    const { data: matches } = await supabaseAdmin
      .from("reconciliation_matches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    // Summary stats
    const { count: totalMatches } = await supabaseAdmin
      .from("reconciliation_matches")
      .select("*", { count: "exact", head: true });

    const { count: fullMatches } = await supabaseAdmin
      .from("reconciliation_matches")
      .select("*", { count: "exact", head: true })
      .eq("match_status", "full_match");

    const { count: pendingCount } = await supabaseAdmin
      .from("reconciliation_matches")
      .select("*", { count: "exact", head: true })
      .eq("match_status", "settlement_pending");

    const { count: mismatchCount } = await supabaseAdmin
      .from("reconciliation_matches")
      .select("*", { count: "exact", head: true })
      .eq("match_status", "amount_mismatch");

    return NextResponse.json({
      runs,
      matches,
      stats: {
        total: totalMatches || 0,
        full_match: fullMatches || 0,
        pending: pendingCount || 0,
        mismatches: mismatchCount || 0,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
