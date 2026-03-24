/**
 * Platform fee configuration for swap transactions
 *
 * Jupiter requires feeAccount to be an *initialized token account* (ATA for the output mint),
 * not the wallet. The platform fee wallet must have an ATA for each supported output mint
 * (USDC, USDT, wSOL, ZEC, ORE, STORE) or swaps to that output will fail with 6025 InvalidTokenAccount.
 */
import { PublicKey } from "@solana/web3.js";

// Platform fee wallet address - receives swap fees (ATAs for each output mint must exist)
export const PLATFORM_FEE_WALLET = new PublicKey("8u9WS6ZkTDwCzqU9rofef7MXS9NvCAwFstVcmwQ8mKmZ");

// Platform fee rate in basis points (25 = 0.25%, 50 = 0.5%, 60 = 0.6%)
// This matches the 0.6% Treasury fee implemented at the SDK level
export const PLATFORM_FEE_BPS = 60; // 0.6% protocol fee

/**
 * Calculate platform fee amount in base units
 * @param swapAmount Amount being swapped in base units (lamports for SOL)
 * @returns Fee amount in base units
 */
export function calculatePlatformFee(swapAmount: number): number {
  return Math.floor((swapAmount * PLATFORM_FEE_BPS) / 10000);
}

/**
 * Get platform fee percentage as a readable string
 */
export function getPlatformFeePercentage(): string {
  return (PLATFORM_FEE_BPS / 100).toFixed(2);
}
