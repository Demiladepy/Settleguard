/**
 * Wallet Balance Helpers
 * 
 * Check public wallet balances for tokens
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { PRIVACY_CASH_TOKENS, PrivacyCashToken } from "./privacy-cash-tokens";

/**
 * Get public SOL balance
 */
export async function getPublicSOLBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance;
}

/**
 * Get public SPL token balance
 */
export async function getPublicSPLBalance(
  connection: Connection,
  publicKey: PublicKey,
  mintAddress: PublicKey
): Promise<number> {
  try {
    // Get associated token account
    const { getAssociatedTokenAddress, getAccount } = await import("@solana/spl-token");
    const tokenAccount = await getAssociatedTokenAddress(mintAddress, publicKey);
    const accountInfo = await getAccount(connection, tokenAccount);
    return Number(accountInfo.amount);
  } catch {
    // Token account doesn't exist, balance is 0
    return 0;
  }
}

/**
 * Get public balance for any token
 */
export async function getPublicTokenBalance(
  connection: Connection,
  publicKey: PublicKey,
  token: PrivacyCashToken
): Promise<number> {
  const tokenInfo = PRIVACY_CASH_TOKENS[token];
  
  if (token === "SOL") {
    return await getPublicSOLBalance(connection, publicKey);
  } else {
    return await getPublicSPLBalance(connection, publicKey, new PublicKey(tokenInfo.mint));
  }
}
