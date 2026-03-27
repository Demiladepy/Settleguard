import { NextRequest, NextResponse } from "next/server";
import { getRecentAuditEntries, appendToAuditChain } from "@/lib/audit-chain";

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

/**
 * POST /api/audit — Append a new entry to the audit chain
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event_type, entity_type, entity_id, actor, payload } = body;

    if (!event_type || !entity_type || !entity_id || !actor) {
      return NextResponse.json(
        { error: "event_type, entity_type, entity_id, and actor are required" },
        { status: 400 }
      );
    }

    const entry = await appendToAuditChain({
      event_type,
      entity_type,
      entity_id,
      actor,
      payload: payload || {},
    });

    return NextResponse.json({ success: true, entry });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to append audit entry" },
      { status: 500 }
    );
  }
}
