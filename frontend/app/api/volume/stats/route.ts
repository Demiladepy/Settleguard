import { NextResponse } from "next/server";
import { getSql, ensureVolumeTables } from "@/lib/db";

export async function GET() {
  try {
    const sql = getSql();
    await ensureVolumeTables(sql);

    const [stats] = await sql`
      SELECT total_volume_usd, total_swaps, updated_at FROM volume_stats WHERE id = 1 LIMIT 1
    `;
    const daily = await sql`
      SELECT day, volume_usd, swap_count FROM volume_daily ORDER BY day DESC LIMIT 30
    `;

    return NextResponse.json({
      totalVolumeUsd: stats ? Number(stats.total_volume_usd) : 0,
      totalSwaps: stats ? Number(stats.total_swaps) : 0,
      updatedAt: stats?.updated_at ?? null,
      daily: daily.map((r) => ({
        day: r.day,
        volumeUsd: Number(r.volume_usd),
        swapCount: Number(r.swap_count),
      })),
    });
  } catch (err) {
    console.error("Volume stats error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch volume stats" },
      { status: 500 }
    );
  }
}
