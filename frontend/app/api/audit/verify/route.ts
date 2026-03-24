import { NextResponse } from "next/server";
import { verifyAuditChain } from "@/lib/audit-chain";

/**
 * POST /api/audit/verify — Verify full audit chain integrity
 */
export async function POST() {
  try {
    const result = await verifyAuditChain();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 500 }
    );
  }
}
