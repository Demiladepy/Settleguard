import { NextRequest, NextResponse } from "next/server";
import { getSql, ensurePointsTables, ensureVolumeTables } from "@/lib/db";

const POINTS_PER_SWAP = 10;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const wallet = body?.wallet as string | undefined;
    const txSignature = body?.txSignature as string | undefined;
    const volumeUsd = typeof body?.volumeUsd === "number" && body.volumeUsd >= 0 ? body.volumeUsd : 0;

    if (!wallet || !txSignature || typeof wallet !== "string" || typeof txSignature !== "string") {
      return NextResponse.json(
        { error: "wallet and txSignature are required" },
        { status: 400 }
      );
    }

    const sql = getSql();
    await ensurePointsTables(sql);

    const existing = await sql`
      SELECT 1 FROM swap_claims WHERE tx_signature = ${txSignature} LIMIT 1
    `;
    if (existing.length > 0) {
      const row = await sql`
        SELECT points FROM points WHERE wallet_address = ${wallet} LIMIT 1
      `;
      return NextResponse.json({
        points: row[0]?.points ?? 0,
        alreadyClaimed: true,
      });
    }

    await sql`
      INSERT INTO swap_claims (tx_signature, wallet_address) VALUES (${txSignature}, ${wallet})
    `;

    await sql`
      INSERT INTO points (wallet_address, points, updated_at)
      VALUES (${wallet}, ${POINTS_PER_SWAP}, NOW())
      ON CONFLICT (wallet_address) DO UPDATE SET
        points = points.points + EXCLUDED.points,
        updated_at = NOW()
    `;

    await ensureVolumeTables(sql);
    const today = new Date().toISOString().slice(0, 10);
    await sql`
      INSERT INTO volume_stats (id, total_volume_usd, total_swaps, updated_at)
      VALUES (1, ${volumeUsd}, 1, NOW())
      ON CONFLICT (id) DO UPDATE SET
        total_volume_usd = volume_stats.total_volume_usd + EXCLUDED.total_volume_usd,
        total_swaps = volume_stats.total_swaps + 1,
        updated_at = NOW()
    `;
    await sql`
      INSERT INTO volume_daily (day, volume_usd, swap_count)
      VALUES (${today}, ${volumeUsd}, 1)
      ON CONFLICT (day) DO UPDATE SET
        volume_usd = volume_daily.volume_usd + EXCLUDED.volume_usd,
        swap_count = volume_daily.swap_count + 1
    `;

    const [row] = await sql`
      SELECT points FROM points WHERE wallet_address = ${wallet} LIMIT 1
    `;

    return NextResponse.json({
      points: row?.points ?? POINTS_PER_SWAP,
      awarded: POINTS_PER_SWAP,
    });
  } catch (err) {
    console.error("Points award error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to award points" },
      { status: 500 }
    );
  }
}
