import { NextResponse } from "next/server";
import { getRecentAuditEntries } from "@/lib/audit-chain";

/**
 * GET /api/audit — Recent audit chain entries
 */
export async function GET() {
  try {
    const entries = await getRecentAuditEntries(100);
    return NextResponse.json({ entries, total: entries.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch audit" },
      { status: 500 }
    );
  }
}
