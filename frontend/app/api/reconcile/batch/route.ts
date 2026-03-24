import { NextResponse } from "next/server";
import { runReconciliation } from "@/lib/reconciliation-engine";

/**
 * POST /api/reconcile/batch — Batch/cron reconciliation endpoint
 * Intended for Inngest/Trigger.dev or cron job invocation
 */
export async function POST() {
  try {
    const result = await runReconciliation("batch_daily");
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("Batch reconciliation failed:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Batch failed" },
      { status: 500 }
    );
  }
}
