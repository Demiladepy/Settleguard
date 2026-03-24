import { NextRequest, NextResponse } from "next/server";
import { getSql, ensurePointsTables } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet");
    if (!wallet) {
      return NextResponse.json(
        { error: "wallet query param is required" },
        { status: 400 }
      );
    }

    const sql = getSql();
    await ensurePointsTables(sql);

    const rows = await sql`
      SELECT points, updated_at FROM points WHERE wallet_address = ${wallet} LIMIT 1
    `;

    const row = rows[0];
    return NextResponse.json({
      wallet,
      points: row ? Number(row.points) : 0,
      updatedAt: row?.updated_at ?? null,
    });
  } catch (err) {
    console.error("Points fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch points" },
      { status: 500 }
    );
  }
}
