import { NextResponse } from "next/server";
import { getSql, ensurePointsTables } from "@/lib/db";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)),
      MAX_LIMIT
    );

    const sql = getSql();
    await ensurePointsTables(sql);

    const rows = await sql`
      SELECT wallet_address, points, updated_at
      FROM points
      ORDER BY points DESC, updated_at DESC
      LIMIT ${limit}
    `;

    const leaderboard = rows.map((r) => ({
      wallet: r.wallet_address,
      points: Number(r.points),
      updatedAt: r.updated_at,
    }));

    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error("Leaderboard fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
