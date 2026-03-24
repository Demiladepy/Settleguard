/**
 * Privacy Cash Helper Functions
 * 
 * Direct integration with Privacy Cash SDK using wallet adapter
 */

import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import {
  getUtxos,
  getBalanceFromUtxos,
  getUtxosSPL,
  getBalanceFromUtxosSPL,
  deposit,
  depositSPL,
  withdraw,
  withdrawSPL,
  EncryptionService,
} from "privacycash/utils";
import { WasmFactory } from "@lightprotocol/hasher.rs";
import { PRIVACY_CASH_TOKENS, PrivacyCashToken } from "./privacy-cash-tokens";
import { getPublicTokenBalance } from "./wallet-balance";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Circuit files path - adjust based on your setup
// For Next.js, these should be in public/circuit2/
const CIRCUIT_BASE_PATH = "/circuit2/transaction2";

/**
 * Get private balance for a token
 */
export async function getPrivateTokenBalanceDirect(
  connection: Connection,
  publicKey: PublicKey,
  encryptionService: EncryptionService,
  token: PrivacyCashToken
): Promise<number> {
  const tokenInfo = PRIVACY_CASH_TOKENS[token];
  const storage = typeof window !== "undefined" ? window.localStorage : ({} as Storage);

  if (token === "SOL") {
    const utxos = await getUtxos({
      publicKey,
      connection,
      encryptionService,
      storage,
    });
    const balance = getBalanceFromUtxos(utxos);
    return balance.lamports;
  } else {
    const utxos = await getUtxosSPL({
      publicKey,
      connection,
      encryptionService,
      storage,
      mintAddress: new PublicKey(tokenInfo.mint),
    });
    const balance = getBalanceFromUtxosSPL(utxos);
    return balance.amount;
  }
}

/**
 * Deposit token to Privacy Cash
 */
export async function depositTokenToPrivacyCash(
  connection: Connection,
  publicKey: PublicKey,
  encryptionService: EncryptionService,
  token: PrivacyCashToken,
  amount: number,
  transactionSigner: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  signer?: PublicKey // Optional: if provided, use this wallet's token account (e.g., ephemeral wallet)
): Promise<{ tx: string }> {
  const tokenInfo = PRIVACY_CASH_TOKENS[token];
  
  // Use signer wallet for balance checks if provided, otherwise use publicKey
  const balanceCheckWallet = signer || publicKey;
  
  // VALIDATION: Check amount is valid before proceeding
  if (!amount || amount <= 0 || !isFinite(amount)) {
    throw new Error(`Invalid deposit amount: ${amount}. Amount must be a positive number.`);
  }
  
  // VALIDATION: Check wallet balance BEFORE attempting deposit to avoid fees on failed transactions
  try {
    if (token === "SOL") {
      // For SOL deposits, check SOL balance (deposit amount + transaction fees)
      const solBalance = await connection.getBalance(balanceCheckWallet);
      const amountInLamports = amount * 1e9;
      const minRequiredSOL = amountInLamports + 5000; // Deposit amount + transaction fee
      
      if (solBalance < minRequiredSOL) {
        throw new Error(
          `Insufficient SOL balance. Need at least ${(minRequiredSOL / 1e9).toFixed(6)} SOL ` +
          `(for deposit: ${amount.toFixed(6)} SOL + fees: ${(5000 / 1e9).toFixed(6)} SOL), ` +
          `but only have ${(solBalance / 1e9).toFixed(6)} SOL.`
        );
      }
    } else {
      // For token deposits, check SOL balance (for transaction fees) and token balance
      const solBalance = await connection.getBalance(balanceCheckWallet);
      const minRequiredSOL = 5000; // Minimum SOL for transaction fees (0.000005 SOL)
      
      if (solBalance < minRequiredSOL) {
        throw new Error(
          `Insufficient SOL balance. Need at least ${(minRequiredSOL / 1e9).toFixed(6)} SOL for transaction fees, ` +
          `but only have ${(solBalance / 1e9).toFixed(6)} SOL.`
        );
      }
      
      // Check token balance (for the token being deposited) in the signer wallet
      const tokenBalance = await getPublicTokenBalance(connection, balanceCheckWallet, token);
      const amountInBaseUnits = amount * Math.pow(10, tokenInfo.decimals);
      
      if (tokenBalance < amountInBaseUnits) {
        const tokenBalanceInUnits = tokenBalance / Math.pow(10, tokenInfo.decimals);
        throw new Error(
          `Insufficient ${token} balance. Need at least ${amount.toFixed(6)} ${token}, ` +
          `but only have ${tokenBalanceInUnits.toFixed(6)} ${token}.`
        );
      }
    }
  } catch (balanceError: any) {
    // If balance check fails, don't proceed - this prevents wasting fees
    // Re-throw the error as-is if it's already a formatted error message
    if (balanceError.message?.includes("Insufficient")) {
      throw balanceError;
    }
    throw new Error(`Failed to verify wallet balance: ${balanceError.message}. Please check your connection and try again.`);
  }
  
  // VALIDATION: Round amount to prevent precision issues that can cause circuit errors
  const decimals = tokenInfo.decimals;
  const roundedAmount = Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
  if (Math.abs(amount - roundedAmount) > 0.00000001) {
    console.warn(`Amount rounded from ${amount} to ${roundedAmount} to prevent precision issues`);
  }
  const finalAmount = roundedAmount;
  
  const lightWasm = await WasmFactory.getInstance();
  const storage = typeof window !== "undefined" ? window.localStorage : ({} as Storage);

  // Intercept console methods to capture Privacy Cash SDK error messages
  // The SDK uses logger.error/log which may output to console.log or console.error
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;
  let capturedErrorText: string | null = null;
  let circuitErrorDetected = false;
  
  const errorInterceptor = (...args: any[]) => {
    const message = args.join(' ');
    if (message.includes('res text:') || message.includes('response.text') || message.includes('error message:')) {
      // Capture the error text from Privacy Cash SDK
      capturedErrorText = message;
      console.log("🔍 Captured Privacy Cash error:", message);
    }
    // Detect circuit errors BEFORE transaction is sent
    if (message.includes('ForceEqualIfEnabled') || message.includes('Transaction_') || message.includes('Error in template')) {
      circuitErrorDetected = true;
      console.error("🚨 CIRCUIT ERROR DETECTED - Transaction will fail!");
    }
    originalConsoleError.apply(console, args);
  };
  
  const logInterceptor = (...args: any[]) => {
    const message = args.join(' ');
    if (message.includes('res text:') || message.includes('response.text') || message.includes('error message:')) {
      // Capture the error text from Privacy Cash SDK
      capturedErrorText = message;
      console.log("🔍 Captured Privacy Cash error:", message);
    }
    // Detect circuit errors in logs too
    if (message.includes('ForceEqualIfEnabled') || message.includes('Transaction_') || message.includes('Error in template')) {
      circuitErrorDetected = true;
      console.error("🚨 CIRCUIT ERROR DETECTED - Transaction will fail!");
    }
    originalConsoleLog.apply(console, args);
  };
  
  console.error = errorInterceptor;
  console.log = logInterceptor;

  try {
    if (token === "SOL") {
      const lamports = Math.round(finalAmount * Math.pow(10, tokenInfo.decimals));
      // Double-check lamports is a valid integer
      if (!Number.isInteger(lamports) || lamports <= 0) {
        throw new Error(`Invalid lamports calculation: ${lamports}. Amount: ${finalAmount}, Decimals: ${decimals}`);
      }
      
      const result = await deposit({
        lightWasm,
        amount_in_lamports: lamports,
        connection,
        encryptionService,
        publicKey,
        transactionSigner,
        keyBasePath: CIRCUIT_BASE_PATH,
        storage,
      });
      
      // Check if circuit error was detected during proof generation
      if (circuitErrorDetected) {
        throw new Error(
          "Zero-knowledge proof circuit error detected. This usually means:\n" +
          "• The deposit amount causes a balance equation mismatch\n" +
          "• Circuit files may be outdated or incompatible\n" +
          "• Try depositing a different amount or check circuit files\n\n" +
          "No transaction was sent - no fees charged."
        );
      }
      
      return result;
    } else {
      const result = await depositSPL({
        lightWasm,
        amount: finalAmount,
        connection,
        encryptionService,
        publicKey,
        transactionSigner,
        keyBasePath: CIRCUIT_BASE_PATH,
        storage,
        mintAddress: new PublicKey(tokenInfo.mint),
        signer: signer || undefined, // Pass signer to use ephemeral wallet's token account
      });
      
      // Check if circuit error was detected during proof generation
      if (circuitErrorDetected) {
        throw new Error(
          "Zero-knowledge proof circuit error detected. This usually means:\n" +
          "• The deposit amount causes a balance equation mismatch\n" +
          "• Circuit files may be outdated or incompatible\n" +
          "• Try depositing a different amount or check circuit files\n\n" +
          "No transaction was sent - no fees charged."
        );
      }
      
      return result;
    }
  } catch (error: any) {
    // Restore original console methods
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    
    // Log the full error for debugging
    console.error("Privacy Cash deposit error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      response: error.response,
      body: error.body,
      status: error.status,
      name: error.name,
      cause: error.cause,
    });

    // Re-throw with more context
    let errorMessage = error.message || "Unknown error occurred";
    
    // Check for circuit errors first (most critical - prevents fees)
    if (circuitErrorDetected || errorMessage.includes("ForceEqualIfEnabled") || errorMessage.includes("Transaction_") || errorMessage.includes("Error in template")) {
      errorMessage = 
        "❌ Zero-Knowledge Proof Circuit Error\n\n" +
        "The deposit failed during proof generation (BEFORE any transaction was sent).\n\n" +
        "Possible causes:\n" +
        "• Amount precision issue - try a rounder amount (e.g., 0.1 instead of 0.10000001)\n" +
        "• Circuit files mismatch - ensure circuit files match SDK version\n" +
        "• Balance equation mismatch - the amount may be incompatible with current UTXO state\n\n" +
        "✅ No fees were charged - transaction was not sent.\n" +
        "💡 Try: Deposit a slightly different amount or split into smaller deposits.";
    }
    // Check for common error patterns
    else if (errorMessage.includes("response not ok") || errorMessage.includes("not ok")) {
      // Use captured error text if available
      if (capturedErrorText) {
        errorMessage = `Deposit failed: ${capturedErrorText}`;
      } else {
        errorMessage = `Deposit failed: Privacy Cash relayer rejected the request. `;
        
        // Common causes and solutions
        const commonIssues = [
          "• Insufficient balance (check you have enough token + SOL for fees)",
          "• Deposit amount exceeds Privacy Cash limits",
          "• Minimum deposit amount not met (check Privacy Cash docs)",
          "• Network/RPC issues - try again in a moment",
          "• Wallet may be rate-limited - wait a few minutes"
        ];
        
        errorMessage += "\n\nPossible causes:\n" + commonIssues.join("\n");
        errorMessage += "\n\nPlease check your balance and try again.";
      }
    } else if (errorMessage.includes("Insufficient balance")) {
      errorMessage = `Insufficient balance. Make sure you have enough ${token} and at least 0.002 SOL for fees.`;
    } else if (errorMessage.includes("Don't deposit more than")) {
      errorMessage = `Deposit amount exceeds Privacy Cash limit. Please reduce the amount.`;
    }
    
    throw new Error(errorMessage);
  } finally {
    // Always restore console methods
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  }
}

/**
 * Withdraw token from Privacy Cash
 */
export async function withdrawTokenFromPrivacyCash(
  connection: Connection,
  publicKey: PublicKey,
  encryptionService: EncryptionService,
  token: PrivacyCashToken,
  amount: number,
  recipientAddress: PublicKey
): Promise<{
  tx: string;
  recipient: string;
  amount_in_lamports?: number;
  amount?: number;
  fee_in_lamports?: number;
  fee?: number;
  isPartial: boolean;
}> {
  const tokenInfo = PRIVACY_CASH_TOKENS[token];
  
  // VALIDATION: Check amount is valid before proceeding
  if (!amount || amount <= 0 || !isFinite(amount)) {
    throw new Error(`Invalid withdraw amount: ${amount}. Amount must be a positive number.`);
  }
  
  // VALIDATION: Round amount to prevent precision issues that can cause circuit errors
  // But only if the amount wasn't already rounded (to avoid double rounding)
  const decimals = tokenInfo.decimals;
  let finalAmount = amount;
  
  // Only round if the amount has excessive precision (more than token decimals)
  const amountString = amount.toString();
  const decimalPart = amountString.includes('.') ? amountString.split('.')[1] : '';
  if (decimalPart.length > decimals) {
    finalAmount = Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
    if (Math.abs(amount - finalAmount) > 0.00000001) {
      console.warn(`Amount rounded from ${amount} to ${finalAmount} to prevent precision issues`);
    }
  }
  
  const lightWasm = await WasmFactory.getInstance();
  const storage = typeof window !== "undefined" ? window.localStorage : ({} as Storage);

  // Intercept console to detect circuit errors - but be more specific to avoid false positives
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;
  let circuitErrorDetected = false;
  
  const errorInterceptor = (...args: any[]) => {
    const message = args.join(' ');
    // Only flag as circuit error if it's clearly an error message, not just a log
    if ((message.includes('ERROR') || message.includes('Error') || message.includes('error')) &&
        (message.includes('ForceEqualIfEnabled') || message.includes('Transaction_') || message.includes('Error in template'))) {
      circuitErrorDetected = true;
      console.error("🚨 CIRCUIT ERROR DETECTED - Transaction will fail!");
    }
    originalConsoleError.apply(console, args);
  };
  
  const logInterceptor = (...args: any[]) => {
    const message = args.join(' ');
    // Only flag as circuit error if it's clearly an error message
    if ((message.includes('ERROR') || message.includes('Error') || message.includes('error')) &&
        (message.includes('ForceEqualIfEnabled') || message.includes('Transaction_') || message.includes('Error in template'))) {
      circuitErrorDetected = true;
      console.error("🚨 CIRCUIT ERROR DETECTED - Transaction will fail!");
    }
    originalConsoleLog.apply(console, args);
  };
  
  console.error = errorInterceptor;
  console.log = logInterceptor;

  try {
    if (token === "SOL") {
      const lamports = Math.round(finalAmount * Math.pow(10, tokenInfo.decimals));
      if (!Number.isInteger(lamports) || lamports <= 0) {
        throw new Error(`Invalid lamports calculation: ${lamports}. Amount: ${finalAmount}, Decimals: ${decimals}`);
      }
      
      const result = await withdraw({
        lightWasm,
        amount_in_lamports: lamports,
        connection,
        encryptionService,
        publicKey,
        recipient: recipientAddress,
        keyBasePath: CIRCUIT_BASE_PATH,
        storage,
      });
      
      // Only check for circuit errors if withdrawal actually failed
      // If it succeeded, ignore any console messages (they might be false positives)
      return result;
    } else {
      const result = await withdrawSPL({
        lightWasm,
        amount: finalAmount,
        connection,
        encryptionService,
        publicKey,
        recipient: recipientAddress,
        keyBasePath: CIRCUIT_BASE_PATH,
        storage,
        mintAddress: new PublicKey(tokenInfo.mint),
      });
      
      // Only check for circuit errors if withdrawal actually failed
      // If it succeeded, ignore any console messages (they might be false positives)
      return result;
    }
  } catch (error: any) {
    // Restore console methods
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    
    let errorMessage = error.message || "Unknown error occurred";
    
    // Check for circuit errors - only if we detected them AND the withdrawal actually failed
    if (circuitErrorDetected || errorMessage.includes("ForceEqualIfEnabled") || errorMessage.includes("Transaction_") || errorMessage.includes("Error in template")) {
      errorMessage = 
        "❌ Zero-Knowledge Proof Circuit Error\n\n" +
        "The withdrawal failed during proof generation (BEFORE any transaction was sent).\n\n" +
        "Possible causes:\n" +
        "• Amount precision issue - try a rounder amount\n" +
        "• Insufficient private balance - check your private balance\n" +
        "• Circuit files mismatch\n\n" +
        "✅ No fees were charged - transaction was not sent.";
    } else if (errorMessage.includes("Need at least 1 unspent UTXO")) {
      errorMessage = `Insufficient private balance. You don't have enough ${token} in your private pool to withdraw ${finalAmount} ${token}.`;
    }
    
    throw new Error(errorMessage);
  } finally {
    // Always restore console methods
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  }
}
