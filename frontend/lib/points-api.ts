/**
 * Client helpers for points API (call from frontend after swap success).
 */

export const POINTS_AWARDED_EVENT = "circuitx-points-awarded";

export async function awardPointsForSwap(
  wallet: string,
  txSignature: string,
  volumeUsd?: number
): Promise<void> {
  try {
    const res = await fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet,
        txSignature,
        volumeUsd: typeof volumeUsd === "number" && volumeUsd >= 0 ? volumeUsd : 0,
      }),
    });
    if (!res.ok) {
      console.warn("Points award failed:", await res.text());
      return;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(POINTS_AWARDED_EVENT));
    }
  } catch (e) {
    console.warn("Points award request failed:", e);
  }
}

export async function fetchPoints(wallet: string): Promise<{ points: number }> {
  const res = await fetch(`/api/points?wallet=${encodeURIComponent(wallet)}`);
  if (!res.ok) throw new Error("Failed to fetch points");
  const data = await res.json();
  return { points: data.points ?? 0 };
}

export async function fetchLeaderboard(limit = 10): Promise<{ wallet: string; points: number }[]> {
  const res = await fetch(`/api/points/leaderboard?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch leaderboard");
  const data = await res.json();
  return data.leaderboard ?? [];
}
