/**
 * Ephemeral Wallet Derivation
 * 
 * Derives a deterministic ephemeral wallet address from the wallet signature.
 * This wallet is used as an intermediate address for private swaps to break on-chain links.
 * 
 * The ephemeral wallet is derived deterministically from the user's wallet signature,
 * ensuring the same user always gets the same ephemeral wallet address.
 */

import { Keypair, PublicKey } from "@solana/web3.js";
import { keccak256 } from "js-sha3";

/**
 * Derive an ephemeral wallet keypair from wallet signature
 * This is deterministic - same signature = same ephemeral wallet
 * 
 * @param signature The wallet signature (from signMessage)
 * @returns A deterministic keypair for the ephemeral wallet
 */
export function deriveEphemeralWallet(signature: Uint8Array): Keypair {
  if (!signature || signature.length === 0) {
    throw new Error("Signature is required to derive ephemeral wallet");
  }

  // Derive a seed from the signature
  // Use a specific prefix to ensure this is for ephemeral wallet derivation
  const seedMessage = new Uint8Array([
    ...new TextEncoder().encode("CircuitX-Ephemeral-Wallet"),
    ...signature,
  ]);

  // Hash using Keccak256 (same as Privacy Cash uses for encryption key V2)
  const seedHash = Buffer.from(keccak256(seedMessage), "hex");
  
  // Create keypair from seed (first 32 bytes)
  const ephemeralKeypair = Keypair.fromSeed(seedHash.slice(0, 32));
  
  return ephemeralKeypair;
}

/**
 * Get the ephemeral wallet public key from signature
 * Useful for checking balance or displaying address without creating full keypair
 * 
 * @param signature The wallet signature
 * @returns The public key of the ephemeral wallet
 */
export function getEphemeralWalletAddress(signature: Uint8Array): PublicKey {
  const keypair = deriveEphemeralWallet(signature);
  return keypair.publicKey;
}

/**
 * Get cached signature from localStorage
 * This is the signature used to derive the encryption key
 */
export function getCachedSignature(publicKey: string): Uint8Array | null {
  const cacheKey = `zkcash-signature-${publicKey}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const cachedSig = JSON.parse(cached);
    return new Uint8Array(Object.values(cachedSig));
  }
  return null;
}
