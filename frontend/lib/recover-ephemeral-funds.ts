/**
 * Recover Funds from Ephemeral Wallet
 * 
 * Utility to check balance and recover SOL/tokens stuck in ephemeral wallet
 * after a failed swap transaction.
 */

import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { deriveEphemeralWallet, getCachedSignature } from "./ephemeral-wallet";
import { PRIVACY_CASH_TOKENS, PrivacyCashToken } from "./privacy-cash-tokens";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Check the balance of the ephemeral wallet
 */
export async function checkEphemeralWalletBalance(
  connection: Connection,
  userPublicKey: PublicKey
): Promise<{ solBalance: number; address: string }> {
  const signature = getCachedSignature(userPublicKey.toBase58());
  if (!signature) {
    throw new Error("No cached signature found. Please sign in to Privacy Cash first.");
  }

  const ephemeralKeypair = deriveEphemeralWallet(signature);
  const ephemeralAddress = ephemeralKeypair.publicKey;
  const balance = await connection.getBalance(ephemeralAddress);

  return {
    solBalance: balance / 1e9, // Convert lamports to SOL
    address: ephemeralAddress.toBase58(),
  };
}

/**
 * Recover SOL from ephemeral wallet back to user's public wallet
 */
export async function recoverSOLFromEphemeralWallet(
  connection: Connection,
  userPublicKey: PublicKey,
  amount?: number // Optional: specific amount to recover (defaults to all minus fees)
): Promise<string> {
  const signature = getCachedSignature(userPublicKey.toBase58());
  if (!signature) {
    throw new Error("No cached signature found. Please sign in to Privacy Cash first.");
  }

  const ephemeralKeypair = deriveEphemeralWallet(signature);
  const ephemeralAddress = ephemeralKeypair.publicKey;
  
  // Check current balance
  const balance = await connection.getBalance(ephemeralAddress);
  
  if (balance === 0) {
    throw new Error("Ephemeral wallet has no balance to recover.");
  }

  // Get the minimum balance for rent exemption (for a basic account)
  // This is typically around 0.00089 SOL (890,000 lamports)
  const rentExemptMin = await connection.getMinimumBalanceForRentExemption(0);
  
  // Calculate transaction fee (typically 5,000 lamports, but can be higher with priority fees)
  // Use a conservative estimate of 0.0001 SOL (100,000 lamports) for fees
  const estimatedFee = 100_000; // 0.0001 SOL
  
  // Total amount we need to leave in the ephemeral wallet:
  // - Rent exemption minimum (to keep account valid)
  // - Transaction fee
  // We must leave this amount or the transaction will fail with "insufficient funds for rent"
  const totalReserve = rentExemptMin + estimatedFee;
  
  if (balance <= totalReserve) {
    throw new Error(
      `Balance too small to recover. Have ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL, ` +
      `need at least ${(totalReserve / LAMPORTS_PER_SOL).toFixed(6)} SOL ` +
      `(rent exemption: ${(rentExemptMin / LAMPORTS_PER_SOL).toFixed(6)} SOL + fees: ${(estimatedFee / LAMPORTS_PER_SOL).toFixed(6)} SOL).`
    );
  }

  // Calculate amount to recover - leave enough for rent exemption + fees
  // We can only recover: balance - rent exemption - fees
  let amountToRecover = amount 
    ? Math.min(amount * LAMPORTS_PER_SOL, balance - totalReserve)
    : balance - totalReserve;

  if (amountToRecover <= 0) {
    throw new Error("Insufficient balance after reserving fees.");
  }

  // Create transfer transaction - we'll try to recover as much as possible
  let transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: ephemeralAddress,
      toPubkey: userPublicKey,
      lamports: amountToRecover,
    })
  );

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = ephemeralAddress;

  // Sign with ephemeral wallet
  transaction.sign(ephemeralKeypair);

  // Try to simulate to get the actual fee
  let actualFee = estimatedFee;
  try {
    const simulation = await connection.simulateTransaction(transaction);
    
    if (simulation.value.err) {
      // If simulation fails, recalculate with estimated fee
      const simFee = estimatedFee;
      const newTotalReserve = rentExemptMin + simFee + 50_000; // Add extra buffer
      
      if (balance > newTotalReserve) {
        amountToRecover = balance - newTotalReserve;
        transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: ephemeralAddress,
            toPubkey: userPublicKey,
            lamports: amountToRecover,
          })
        );
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = ephemeralAddress;
        transaction.sign(ephemeralKeypair);
      } else {
        throw new Error(
          `Cannot recover: balance too small after accounting for rent exemption and fees. ` +
          `Have ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL, need at least ${(newTotalReserve / LAMPORTS_PER_SOL).toFixed(6)} SOL.`
        );
      }
    } else {
      // Simulation succeeded - use estimated fee (simulation doesn't return fee directly for regular transactions)
      actualFee = estimatedFee;
      // Recalculate with actual fee to maximize recovery
      const actualTotalReserve = rentExemptMin + actualFee;
      if (balance > actualTotalReserve) {
        const optimizedAmount = balance - actualTotalReserve;
        if (optimizedAmount < amountToRecover) {
          // Use the optimized amount if it's less (more conservative)
          amountToRecover = optimizedAmount;
          transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: ephemeralAddress,
              toPubkey: userPublicKey,
              lamports: amountToRecover,
            })
          );
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = ephemeralAddress;
          transaction.sign(ephemeralKeypair);
        }
      }
    }
  } catch (simError: any) {
    // If simulation completely fails, we'll still try but with the conservative amount
    console.warn("Simulation failed, using conservative estimate:", simError);
  }

  // Send transaction with retry logic for blockhash expiration
  let txSignature: string;
  let lastError: Error | null = null;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get FRESH blockhash right before sending (critical to prevent expiration)
      // Rebuild transaction with fresh blockhash (simulation may have modified amountToRecover)
      const freshTransaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: ephemeralAddress,
          toPubkey: userPublicKey,
          lamports: amountToRecover,
        })
      );
      
      const { blockhash: freshBlockhash, lastValidBlockHeight: freshLastValidBlockHeight } = 
        await connection.getLatestBlockhash("confirmed");
      freshTransaction.recentBlockhash = freshBlockhash;
      freshTransaction.feePayer = ephemeralAddress;
      freshTransaction.sign(ephemeralKeypair);

      // Send transaction immediately after getting fresh blockhash
      txSignature = await connection.sendRawTransaction(freshTransaction.serialize(), {
        skipPreflight: false, // Use preflight to catch errors early
        maxRetries: 3,
      });

      // Wait for confirmation
      await connection.confirmTransaction(
        {
          signature: txSignature,
          blockhash: freshBlockhash,
          lastValidBlockHeight: freshLastValidBlockHeight,
        },
        "confirmed"
      );

      return txSignature;
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a blockhash expiration error
      if (
        error.message?.includes("block height exceeded") ||
        error.message?.includes("Blockhash not found") ||
        error.message?.includes("blockhash") ||
        error.message?.includes("expired")
      ) {
        if (attempt < maxRetries - 1) {
          // Wait a bit before retrying with fresh blockhash
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue; // Retry with fresh blockhash
        } else {
          throw new Error(
            `Transaction failed: Blockhash expired after ${maxRetries} attempts. ` +
            `This can happen if the network is slow. Please try again - the blockhash will be refreshed automatically.`
          );
        }
      } else {
        // For other errors, throw immediately
        throw error;
      }
    }
  }

  // If we get here, all retries failed
  throw lastError || new Error("Failed to send transaction after multiple attempts");
}

/**
 * Check SPL token balance in ephemeral wallet
 */
export async function checkEphemeralTokenBalance(
  connection: Connection,
  userPublicKey: PublicKey,
  token: PrivacyCashToken
): Promise<{ balance: number; balanceInUnits: number; address: string }> {
  const signature = getCachedSignature(userPublicKey.toBase58());
  if (!signature) {
    throw new Error("No cached signature found. Please sign in to Privacy Cash first.");
  }

  const ephemeralKeypair = deriveEphemeralWallet(signature);
  const ephemeralAddress = ephemeralKeypair.publicKey;
  const tokenInfo = PRIVACY_CASH_TOKENS[token];

  try {
    // Get associated token account
    const { getAssociatedTokenAddress, getAccount } = await import("@solana/spl-token");
    const tokenAccount = await getAssociatedTokenAddress(
      new PublicKey(tokenInfo.mint),
      ephemeralAddress
    );
    const accountInfo = await getAccount(connection, tokenAccount);
    const balance = Number(accountInfo.amount);
    const balanceInUnits = balance / Math.pow(10, tokenInfo.decimals);

    return {
      balance,
      balanceInUnits,
      address: ephemeralAddress.toBase58(),
    };
  } catch {
    // Token account doesn't exist, balance is 0
    return {
      balance: 0,
      balanceInUnits: 0,
      address: ephemeralAddress.toBase58(),
    };
  }
}

/**
 * Recover SPL token from ephemeral wallet back to user's public wallet
 */
export async function recoverTokenFromEphemeralWallet(
  connection: Connection,
  userPublicKey: PublicKey,
  token: PrivacyCashToken,
  amount?: number // Optional: specific amount to recover (defaults to all)
): Promise<string> {
  const signature = getCachedSignature(userPublicKey.toBase58());
  if (!signature) {
    throw new Error("No cached signature found. Please sign in to Privacy Cash first.");
  }

  const ephemeralKeypair = deriveEphemeralWallet(signature);
  const ephemeralAddress = ephemeralKeypair.publicKey;
  const tokenInfo = PRIVACY_CASH_TOKENS[token];

  // Import SPL token functions
  const {
    getAssociatedTokenAddress,
    getAccount,
    createTransferInstruction,
    getOrCreateAssociatedTokenAccount,
  } = await import("@solana/spl-token");

  // Get ephemeral wallet's token account
  const ephemeralTokenAccount = await getAssociatedTokenAddress(
    new PublicKey(tokenInfo.mint),
    ephemeralAddress
  );

  // Check balance
  let tokenBalance: number;
  try {
    const accountInfo = await getAccount(connection, ephemeralTokenAccount);
    tokenBalance = Number(accountInfo.amount);
  } catch {
    throw new Error(`No ${token} balance found in ephemeral wallet.`);
  }

  if (tokenBalance === 0) {
    throw new Error(`Ephemeral wallet has no ${token} to recover.`);
  }

  // Get or create user's token account
  const userTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    ephemeralKeypair, // Signer (ephemeral wallet will pay for account creation if needed)
    new PublicKey(tokenInfo.mint),
    userPublicKey
  );

  // Calculate amount to transfer
  const amountInBaseUnits = amount
    ? Math.min(amount * Math.pow(10, tokenInfo.decimals), tokenBalance)
    : tokenBalance;

  if (amountInBaseUnits <= 0) {
    throw new Error("Invalid amount to recover.");
  }

  // Check if ephemeral wallet has enough SOL for transaction fees
  const ephemeralSOLBalance = await connection.getBalance(ephemeralAddress);
  const minSOLForFees = 5000; // Minimum SOL for transaction fees

  if (ephemeralSOLBalance < minSOLForFees) {
    throw new Error(
      `Ephemeral wallet needs at least ${(minSOLForFees / 1e9).toFixed(6)} SOL for transaction fees, ` +
      `but only has ${(ephemeralSOLBalance / 1e9).toFixed(6)} SOL. ` +
      `Please recover SOL first or add SOL to the ephemeral wallet.`
    );
  }

  // Create transfer instruction
  const transferInstruction = createTransferInstruction(
    ephemeralTokenAccount,
    userTokenAccount.address,
    ephemeralAddress,
    amountInBaseUnits
  );

  // Retry logic with blockhash refresh
  let txSignature: string;
  let lastError: Error | null = null;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Build transaction
      const transaction = new Transaction().add(transferInstruction);

      // Get FRESH blockhash right before sending (critical to prevent expiration)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = ephemeralAddress;

      // Sign with ephemeral wallet
      transaction.sign(ephemeralKeypair);

      // Send transaction immediately after getting fresh blockhash
      txSignature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Wait for confirmation
      await connection.confirmTransaction(
        {
          signature: txSignature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed"
      );

      return txSignature;
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a blockhash expiration error
      if (
        error.message?.includes("block height exceeded") ||
        error.message?.includes("Blockhash not found") ||
        error.message?.includes("blockhash") ||
        error.message?.includes("expired")
      ) {
        if (attempt < maxRetries - 1) {
          // Wait a bit before retrying with fresh blockhash
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue; // Retry with fresh blockhash
        } else {
          throw new Error(
            `Transaction failed: Blockhash expired after ${maxRetries} attempts. ` +
            `This can happen if the network is slow. Please try again - the blockhash will be refreshed automatically.`
          );
        }
      } else {
        // For other errors, throw immediately
        throw error;
      }
    }
  }

  // If we get here, all retries failed
  throw lastError || new Error("Failed to send transaction after multiple attempts");
}
