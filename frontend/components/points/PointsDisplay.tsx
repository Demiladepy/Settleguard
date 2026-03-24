"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { fetchPoints } from "@/lib/points-api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type PointsDisplayProps = {
  /** Controlled open state for leaderboard dialog (e.g. when opened from mobile menu). */
  leaderboardOpen?: boolean;
  onLeaderboardOpenChange?: (open: boolean) => void;
  /** When false, hide the Leaderboard trigger button (use with mobile menu). */
  showLeaderboardTrigger?: boolean;
};

export function PointsDisplay({
  leaderboardOpen,
  onLeaderboardOpenChange,
  showLeaderboardTrigger = true,
}: PointsDisplayProps = {}) {
  const { publicKey, connected } = useWallet();
  const [points, setPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [internalLeaderboardOpen, setInternalLeaderboardOpen] = useState(false);
  const isControlled = leaderboardOpen !== undefined && onLeaderboardOpenChange !== undefined;
  const dialogOpen = isControlled ? leaderboardOpen : internalLeaderboardOpen;
  const setDialogOpen = isControlled ? onLeaderboardOpenChange! : setInternalLeaderboardOpen;

  const refreshPoints = () => {
    if (!publicKey) return;
    setLoading(true);
    fetchPoints(publicKey.toBase58())
      .then((res) => setPoints(res.points))
      .catch(() => setPoints(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!connected || !publicKey) {
      setPoints(null);
      return;
    }
    refreshPoints();
  }, [connected, publicKey]);

  useEffect(() => {
    const handler = () => refreshPoints();
    window.addEventListener("circuitx-points-awarded", handler);
    return () => window.removeEventListener("circuitx-points-awarded", handler);
  }, [publicKey]);

  if (!connected) return null;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/50 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-300 shrink-0 ml-1 lg:ml-0">
        {loading && points === null ? (
          <span className="animate-pulse">...</span>
        ) : (
          <span className="font-medium text-white tabular-nums">{points ?? 0} pts</span>
        )}
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        {showLeaderboardTrigger && (
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="hidden lg:inline-flex border-gray-700 bg-gray-900/50 text-gray-300 hover:bg-gray-800 hover:text-white text-sm"
            >
              Leaderboard
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="border-gray-800 bg-gray-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Points Leaderboard</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-400 py-4">Coming soon.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
