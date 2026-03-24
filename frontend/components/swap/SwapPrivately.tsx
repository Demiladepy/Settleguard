"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, VersionedTransaction, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Loader2, ArrowDownUp } from "lucide-react";
import { toast } from "sonner";
import { JupiterAPI } from "@/lib/jupiter-api";
import {
  PrivacyCashToken,
  PRIVACY_CASH_TOKENS,
  PRIVACY_CASH_TOKEN_LIST,
} from "@/lib/privacy-cash-tokens";
import { usePrivacyCash } from "@/lib/privacy-cash";
import {
  getPrivateTokenBalanceDirect,
  depositTokenToPrivacyCash,
  withdrawTokenFromPrivacyCash,
} from "@/lib/privacy-cash-helpers";
import { deriveEphemeralWallet } from "@/lib/ephemeral-wallet";
import { getPublicTokenBalance } from "@/lib/wallet-balance";
import { checkEphemeralWalletBalance, recoverSOLFromEphemeralWallet, checkEphemeralTokenBalance, recoverTokenFromEphemeralWallet } from "@/lib/recover-ephemeral-funds";
import { awardPointsForSwap } from "@/lib/points-api";
import { PLATFORM_FEE_WALLET, PLATFORM_FEE_BPS } from "@/lib/platform-fee-config";
import { getTokenPriceUsd } from "@/lib/jupiter-api";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { Wallet } from "lucide-react";
/* eslint-disable @typescript-eslint/no-explicit-any */

export function SwapPrivately() {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const {
    isInitialized: privacyCashInitialized,
    encryptionService,
    signature,
    initializeEncryption,
  } = usePrivacyCash();
  const [inputToken, setInputToken] = useState<PrivacyCashToken>("SOL");
  const [outputToken, setOutputToken] = useState<PrivacyCashToken>("USDC");
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [isGettingQuote, setIsGettingQuote] = useState(false);
  const [priceImpact, setPriceImpact] = useState<string | null>(null);
  const [jupiterAPI, setJupiterAPI] = useState<JupiterAPI | null>(null);
  const [enablePrivateMode, setEnablePrivateMode] = useState(true); // Default to enabled
  const [privateBalance, setPrivateBalance] = useState<number | null>(null);
  const [publicBalance, setPublicBalance] = useState<number | null>(null);
  const [hasPrivateInputBalance, setHasPrivateInputBalance] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const balanceCheckInProgress = useRef(false);
  const [ephemeralBalance, setEphemeralBalance] = useState<number | null>(null);
  const [ephemeralAddress, setEphemeralAddress] = useState<string | null>(null);
  const [ephemeralTokenBalances, setEphemeralTokenBalances] = useState<Record<PrivacyCashToken, number>>({} as Record<PrivacyCashToken, number>);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isRecoveringToken, setIsRecoveringToken] = useState<PrivacyCashToken | null>(null);
  const [isCheckingEphemeral, setIsCheckingEphemeral] = useState(false);

  useEffect(() => {
    if (connection) {
      setJupiterAPI(new JupiterAPI(connection));
    }
  }, [connection]);

  // Auto-initialize Privacy Cash when wallet connects
  useEffect(() => {
    if (connected && !privacyCashInitialized && !isInitializing && publicKey) {
      setIsInitializing(true);
      initializeEncryption()
        .then(() => {
          toast.success("Privacy Cash initialized");
        })
        .catch((error) => {
          console.error("Failed to initialize Privacy Cash:", error);
          // Don't show error toast on auto-init, user can manually initialize if needed
          // Common reasons: user rejected signature, wallet doesn't support signMessage
        })
        .finally(() => {
          setIsInitializing(false);
        });
    }
  }, [connected, privacyCashInitialized, initializeEncryption, isInitializing, publicKey]);

  // Check both private and public balances when token changes
  useEffect(() => {
    if (balanceCheckInProgress.current) return;

    const checkBalances = async () => {
      if (balanceCheckInProgress.current) return;
      balanceCheckInProgress.current = true;

      try {
        if (publicKey && inputToken && connected) {
          // Check public balance
          try {
            const pubBalance = await getPublicTokenBalance(connection, publicKey, inputToken);
            setPublicBalance(pubBalance);
          } catch (error) {
            console.error("Failed to check public balance:", error);
            setPublicBalance(null);
          }

          // Check private balance (if Privacy Cash is initialized)
          if (encryptionService && privacyCashInitialized) {
            try {
              const privBalance = await getPrivateTokenBalanceDirect(
                connection,
                publicKey,
                encryptionService,
                inputToken
              );
              setPrivateBalance(privBalance);
              setHasPrivateInputBalance(privBalance > 0);
            } catch (error) {
              console.error("Failed to check private balance:", error);
              setPrivateBalance(null);
              setHasPrivateInputBalance(false);
            }
          } else {
            setPrivateBalance(null);
            setHasPrivateInputBalance(false);
          }
        } else {
          setPrivateBalance(null);
          setPublicBalance(null);
          setHasPrivateInputBalance(false);
        }
      } finally {
        balanceCheckInProgress.current = false;
      }
    };

    checkBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encryptionService, publicKey?.toString(), inputToken, connected, privacyCashInitialized]);

  const getQuote = useCallback(async () => {
    if (!jupiterAPI || !publicKey || !inputAmount || parseFloat(inputAmount) <= 0) return;

    setIsGettingQuote(true);
    try {
      const amountInBaseUnits =
        parseFloat(inputAmount) * Math.pow(10, PRIVACY_CASH_TOKENS[inputToken].decimals);

      const quote = await jupiterAPI.getQuote({
        inputMint: PRIVACY_CASH_TOKENS[inputToken].mint,
        outputMint: PRIVACY_CASH_TOKENS[outputToken].mint,
        amount: amountInBaseUnits,
        slippageBps: 50, // 0.5% slippage
      });

      const outputAmountFormatted =
        parseFloat(quote.outAmount) / Math.pow(10, PRIVACY_CASH_TOKENS[outputToken].decimals);
      setOutputAmount(outputAmountFormatted.toFixed(6));
      setPriceImpact(quote.priceImpactPct);
    } catch (error: any) {
      console.error("Quote error:", error);
      setOutputAmount("");
      setPriceImpact(null);
      // Don't show error toast for quote failures during typing
    } finally {
      setIsGettingQuote(false);
    }
  }, [jupiterAPI, publicKey, inputAmount, inputToken, outputToken]);

  // Get quote when input changes
  useEffect(() => {
    if (
      jupiterAPI &&
      connected &&
      inputAmount &&
      parseFloat(inputAmount) > 0 &&
      inputToken !== outputToken
    ) {
      const timeoutId = setTimeout(() => {
        getQuote();
      }, 500); // Debounce

      return () => clearTimeout(timeoutId);
    } else {
      setOutputAmount("");
      setPriceImpact(null);
    }
  }, [inputAmount, inputToken, outputToken, jupiterAPI, connected, getQuote]);

  const handleSwap = async () => {
    if (!jupiterAPI || !publicKey || !signTransaction || !inputAmount || parseFloat(inputAmount) <= 0) {
      toast.error("Please connect wallet and enter amount");
      return;
    }

    if (inputToken === outputToken) {
      toast.error("Please select different tokens");
      return;
    }

    setIsLoading(true);
    setSwapStatus("Starting private swap flow...");

    try {
      // VALIDATION: Round input amount to prevent precision issues that cause circuit errors
      const inputDecimals = PRIVACY_CASH_TOKENS[inputToken].decimals;
      let roundedInputAmount = parseFloat(inputAmount);
      roundedInputAmount = Math.round(roundedInputAmount * Math.pow(10, inputDecimals)) / Math.pow(10, inputDecimals);

      if (Math.abs(parseFloat(inputAmount) - roundedInputAmount) > 0.00000001) {
        console.warn(`Input amount rounded from ${inputAmount} to ${roundedInputAmount} to prevent precision issues`);
      }

      const amountInBaseUnits = roundedInputAmount * Math.pow(10, inputDecimals);

      // VALIDATION: Ensure amount is a valid integer in base units
      if (!Number.isInteger(amountInBaseUnits) || amountInBaseUnits <= 0) {
        throw new Error(`Invalid swap amount: ${inputAmount}. Please use a valid amount with up to ${inputDecimals} decimal places.`);
      }

      // Check if user has sufficient balance (private or public)
      const hasPrivateBalance = hasPrivateInputBalance && privateBalance !== null && privateBalance >= amountInBaseUnits;
      const hasPublicBalance = publicBalance !== null && publicBalance >= amountInBaseUnits;

      if (!hasPrivateBalance && !hasPublicBalance) {
        toast.error("Insufficient balance", {
          description: "Please ensure you have enough tokens in your wallet or private balance",
        });
        setIsLoading(false);
        return;
      }

      // Choose flow based on balance and private mode preference
      if (enablePrivateMode && hasPrivateBalance && encryptionService && signature) {
        // FULL PRIVATE SWAP FLOW: Withdraw → Swap → Deposit
        // 1. Withdraw to ephemeral wallet
        toast.loading("Withdrawing to ephemeral wallet...", { id: "swap" });
        setSwapStatus("Withdrawing to ephemeral wallet");
        const ephemeralKeypair = deriveEphemeralWallet(signature);
        const ephemeralAddress = ephemeralKeypair.publicKey;

        // Use the rounded amount from validation above
        const inputAmountInTokenUnits = roundedInputAmount;

        const withdrawResult = await withdrawTokenFromPrivacyCash(
          connection,
          publicKey,
          encryptionService,
          inputToken,
          inputAmountInTokenUnits,
          ephemeralAddress
        );

        toast.loading("Waiting for withdrawal confirmation...", { id: "swap" });
        setSwapStatus("Waiting for withdrawal confirmation");
        // Wait for withdrawal to confirm
        await connection.confirmTransaction(withdrawResult.tx, "confirmed");

        // Ensure ephemeral wallet has enough SOL for transaction fees
        // Jupiter swaps can require 0.03-0.05 SOL for fees, especially for complex routes
        const solForFees = 0.03; // 0.03 SOL buffer for fees (will be returned after swap)
        const ephemeralBalance = await connection.getBalance(ephemeralAddress);

        // If swapping SOL, the withdrawn amount is the swap amount, so we need ADDITIONAL SOL for fees
        // If swapping other tokens, we just need SOL for fees
        const solNeeded = inputToken === "SOL"
          ? (roundedInputAmount + solForFees) * 1e9 // Swap amount + fees
          : solForFees * 1e9; // Just fees

        if (ephemeralBalance < solNeeded) {
          toast.loading("Funding ephemeral wallet with SOL for fees...", { id: "swap" });
          setSwapStatus("Funding ephemeral wallet with SOL for fees");
          const solToWithdraw = (solNeeded - ephemeralBalance) / 1e9; // Amount needed in SOL

          if (solToWithdraw > 0) {
            try {
              // Try to withdraw from private pool first
              const solWithdrawResult = await withdrawTokenFromPrivacyCash(
                connection,
                publicKey,
                encryptionService,
                "SOL",
                solToWithdraw,
                ephemeralAddress
              );
              await connection.confirmTransaction(solWithdrawResult.tx, "confirmed");
            } catch (error: any) {
              // If private pool doesn't have SOL, use public wallet directly
              if (error.message?.includes("unspent UTXO") || error.message?.includes("no balance")) {
                toast.loading("Using public wallet SOL to fund ephemeral wallet...", { id: "swap" });
                const publicSolBalance = await connection.getBalance(publicKey);
                const solNeededLamports = solNeeded - ephemeralBalance;

                if (publicSolBalance < solNeededLamports) {
                  throw new Error(
                    `Insufficient SOL in public wallet. Need ${(solNeededLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL for fees, ` +
                    `but only have ${(publicSolBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL.`
                  );
                }

                // Transfer directly from public wallet to ephemeral wallet
                const fundTx = new Transaction().add(
                  SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: ephemeralAddress,
                    lamports: solNeededLamports,
                  })
                );

                const { blockhash: fundBlockhash } = await connection.getLatestBlockhash("confirmed");
                fundTx.recentBlockhash = fundBlockhash;
                fundTx.feePayer = publicKey;

                const fundSim = await connection.simulateTransaction(fundTx);
                if (fundSim.value.err) {
                  throw new Error(`Funding transaction simulation failed: ${JSON.stringify(fundSim.value.err)}. Cannot safely proceed.`);
                }
                const signedFundTx = await signTransaction(fundTx);
                const fundSignature = await connection.sendRawTransaction(signedFundTx.serialize(), {
                  skipPreflight: false,
                  maxRetries: 3,
                });
                await connection.confirmTransaction(fundSignature, "confirmed");
              } else {
                throw error;
              }
            }
          }
        }

        // 2. Get quote for swap from ephemeral wallet
        toast.loading("Getting swap quote...", { id: "swap" });
        setSwapStatus("Getting swap quote");
        const quote = await jupiterAPI.getQuote({
          inputMint: PRIVACY_CASH_TOKENS[inputToken].mint,
          outputMint: PRIVACY_CASH_TOKENS[outputToken].mint,
          amount: amountInBaseUnits,
          slippageBps: 50,
          platformFeeBps: PLATFORM_FEE_BPS,
        });

        // 3. Build swap transaction for ephemeral wallet
        toast.loading("Building swap transaction...", { id: "swap" });
        setSwapStatus("Building swap transaction");
        const outputMintForFee = new PublicKey(PRIVACY_CASH_TOKENS[outputToken].mint);
        const feeAccount = await getAssociatedTokenAddress(outputMintForFee, PLATFORM_FEE_WALLET);
        const swapResponse = await jupiterAPI.buildSwapTransaction({
          quoteResponse: quote,
          userPublicKey: ephemeralAddress, // Swap from ephemeral wallet
          wrapUnwrapSOL: true,
          dynamicComputeUnitLimit: true,
          feeAccount: feeAccount.toBase58(),
        });

        // 4. Sign and execute swap with ephemeral wallet
        toast.loading("Executing swap from ephemeral wallet...", { id: "swap" });
        setSwapStatus("Executing swap from ephemeral wallet");
        const swapTransaction = VersionedTransaction.deserialize(
          Buffer.from(swapResponse.swapTransaction, "base64")
        );
        swapTransaction.sign([ephemeralKeypair]);

        // Verify ephemeral wallet has enough balance before sending
        const finalEphemeralBalance = await connection.getBalance(ephemeralAddress);
        const finalEphemeralBalanceSol = finalEphemeralBalance / LAMPORTS_PER_SOL;

        // Simulate transaction first to catch errors early
        try {
          const simulation = await connection.simulateTransaction(swapTransaction, {
            replaceRecentBlockhash: true,
            sigVerify: false,
          });

          if (simulation.value.err) {
            const errorMsg = JSON.stringify(simulation.value.err);
            const hint6025 = errorMsg.includes("6025") ? " Jupiter 6025 (InvalidTokenAccount): ensure the platform fee ATA for the output mint is initialized." : "";
            throw new Error(`Swap simulation failed: ${errorMsg}. Ephemeral wallet balance: ${finalEphemeralBalanceSol.toFixed(6)} SOL.${hint6025}`);
          }

          // Check if we have enough SOL for the transaction fee
          // SimulatedTransactionResponse does not include an explicit fee field,
          // so we use a conservative static estimate in lamports.
          const estimatedFee = 5000; // ~0.000005 SOL
          if (finalEphemeralBalance < estimatedFee) {
            throw new Error(
              `Insufficient SOL for transaction fees. Ephemeral wallet has ${finalEphemeralBalanceSol.toFixed(6)} SOL, ` +
              `but needs at least ${(estimatedFee / LAMPORTS_PER_SOL).toFixed(6)} SOL for fees.`
            );
          }
        } catch (simError: any) {
          if (simError.message?.includes("simulation") || simError.message?.includes("6025")) {
            throw simError; // Re-throw simulation errors
          }
          console.warn("Simulation check failed, proceeding anyway:", simError);
        }

        const swapSignature = await connection.sendRawTransaction(
          swapTransaction.serialize(),
          {
            skipPreflight: false, // Preflight will catch most errors
            maxRetries: 3,
          }
        );

        // Wait for confirmation with better error handling
        try {
          const { blockhash: swapBlockhash, lastValidBlockHeight: swapLastValidBlockHeight } =
            await connection.getLatestBlockhash("confirmed");

          const confirmation = await Promise.race([
            connection.confirmTransaction(
              {
                signature: swapSignature,
                blockhash: swapBlockhash,
                lastValidBlockHeight: swapLastValidBlockHeight,
              },
              "confirmed"
            ),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("TIMEOUT")), 60000) // 60 second timeout
            )
          ]) as any;

          if (confirmation.value?.err) {
            throw new Error(`Swap transaction failed: ${JSON.stringify(confirmation.value.err)}`);
          }
        } catch (error: any) {
          // If confirmation times out, check if transaction actually succeeded
          if (error.message === "TIMEOUT" || error.message?.includes("not confirmed")) {
            toast.loading("Confirmation timed out, checking transaction status...", { id: "swap" });
            // Check transaction status directly
            const txStatus = await connection.getSignatureStatus(swapSignature);
            if (txStatus.value?.err) {
              throw new Error(`Swap transaction failed: ${JSON.stringify(txStatus.value.err)}`);
            } else if (txStatus.value && (txStatus.value.confirmationStatus === "confirmed" || txStatus.value.confirmationStatus === "finalized")) {
              // Transaction actually succeeded
              toast.success("Swap confirmed!", {
                id: "swap",
                description: `Transaction: ${swapSignature.slice(0, 8)}...`,
              });
            } else {
              // Transaction status unknown - provide helpful error
              throw new Error(
                `Transaction confirmation timed out. The swap may still be processing. ` +
                `Check status: https://solscan.io/tx/${swapSignature}. ` +
                `If the swap succeeded, you can recover any remaining SOL from the ephemeral wallet.`
              );
            }
          } else {
            throw error;
          }
        }

        // 5. Deposit output directly from ephemeral wallet to Privacy Cash
        // Check ACTUAL balance in ephemeral wallet (handles slippage/fees)
        toast.loading("Checking actual balance in ephemeral wallet...", { id: "swap" });
        setSwapStatus("Checking actual balance in ephemeral wallet");
        const outputDecimals = PRIVACY_CASH_TOKENS[outputToken].decimals;
        const tokenInfo = PRIVACY_CASH_TOKENS[outputToken];

        let actualBalanceInBaseUnits: number;
        if (outputToken === "SOL") {
          // For SOL, check SOL balance
          actualBalanceInBaseUnits = await connection.getBalance(ephemeralAddress);
        } else {
          // For SPL tokens, check token account balance
          const { getAssociatedTokenAddress, getAccount } = await import("@solana/spl-token");
          const ephemeralTokenAccount = await getAssociatedTokenAddress(
            new PublicKey(tokenInfo.mint),
            ephemeralAddress
          );
          try {
            const accountInfo = await getAccount(connection, ephemeralTokenAccount);
            actualBalanceInBaseUnits = Number(accountInfo.amount);
          } catch {
            throw new Error(`Output token ${outputToken} not found in ephemeral wallet. Swap may have failed.`);
          }
        }

        // Convert to token units and round
        let outputAmountInTokenUnits = actualBalanceInBaseUnits / Math.pow(10, outputDecimals);
        outputAmountInTokenUnits = Math.round(outputAmountInTokenUnits * Math.pow(10, outputDecimals)) / Math.pow(10, outputDecimals);

        // Validate output amount before attempting deposit
        if (!outputAmountInTokenUnits || outputAmountInTokenUnits <= 0) {
          throw new Error(`Invalid output amount: ${outputAmountInTokenUnits}. Swap may have failed.`);
        }

        // Deposit directly from ephemeral wallet to Privacy Cash using ACTUAL balance
        toast.loading(`Depositing ${outputAmountInTokenUnits.toFixed(6)} ${outputToken} to Privacy Cash...`, { id: "swap" });
        setSwapStatus(`Depositing ${outputToken} back into Privacy Cash`);

        const depositResult = await depositTokenToPrivacyCash(
          connection,
          publicKey,
          encryptionService,
          outputToken,
          outputAmountInTokenUnits,
          async (tx: VersionedTransaction) => {
            // Sign with ephemeral wallet keypair (tokens are in ephemeral wallet)
            tx.sign([ephemeralKeypair]);
            return tx;
          },
          ephemeralAddress // Pass ephemeral wallet as signer to use its token account
        );

        // 6. Return remaining SOL from ephemeral wallet to main wallet
        try {
          const remainingBalance = await connection.getBalance(ephemeralAddress);
          const minReserve = 5000; // Keep 0.000005 SOL as minimum reserve (dust)
          const solToReturn = (remainingBalance - minReserve) / 1e9; // Convert to SOL

          if (solToReturn > 0.001) { // Only return if more than 0.001 SOL (worth the transaction fee)
            toast.loading("Returning remaining SOL to your wallet...", { id: "swap" });
            setSwapStatus("Returning remaining SOL to your wallet");

            const returnTx = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: ephemeralAddress,
                toPubkey: publicKey,
                lamports: remainingBalance - minReserve,
              })
            );

            const latestBlockhash = await connection.getLatestBlockhash();
            returnTx.recentBlockhash = latestBlockhash.blockhash;
            returnTx.feePayer = ephemeralAddress;
            returnTx.sign(ephemeralKeypair);

            const returnSignature = await connection.sendRawTransaction(returnTx.serialize(), {
              skipPreflight: false,
              maxRetries: 3,
            });
            await connection.confirmTransaction(returnSignature, "confirmed");
          }
        } catch (error) {
          // Don't fail the swap if returning SOL fails - just log it
          console.warn("Failed to return remaining SOL from ephemeral wallet:", error);
        }

        toast.success("Private swap completed!", {
          id: "swap",
          description: `Withdraw: ${withdrawResult.tx.slice(0, 8)}... | Swap: ${swapSignature.slice(0, 8)}... | Deposit: ${depositResult.tx.slice(0, 8)}...`,
          action: {
            label: "View Swap",
            onClick: () => window.open(`https://solscan.io/tx/${swapSignature}`, "_blank"),
          },
        });
        setSwapStatus("Private swap completed");
        if (publicKey) {
          const priceUsd = await getTokenPriceUsd(PRIVACY_CASH_TOKENS[outputToken].mint);
          const volumeUsd = outputAmountInTokenUnits * priceUsd;
          awardPointsForSwap(publicKey.toBase58(), swapSignature, volumeUsd);
        }
      } else if (hasPublicBalance) {
        // FULL PRIVATE SWAP FROM PUBLIC BALANCE (Automatic):
        // 1. Deposit public balance → Privacy Cash
        // 2. Withdraw privately → Ephemeral wallet
        // 3. Swap from ephemeral wallet
        // 4. Deposit output privately → Privacy Cash
        // 5. Withdraw output → Public wallet (user receives it)

        if (!enablePrivateMode || !privacyCashInitialized || !encryptionService || !signature) {
          toast.error("Privacy Cash not initialized", {
            description: "Please sign in to Privacy Cash to enable private swaps",
          });
          setIsLoading(false);
          return;
        }

        // Use the rounded amount from validation above
        const inputAmountInTokenUnits = roundedInputAmount;
        const solForFees = 0.03; // 0.03 SOL buffer for fees (will be returned)

        // Check current SOL balance directly (not from stale state)
        const currentSolBalance = await connection.getBalance(publicKey);
        const currentSolBalanceInSol = currentSolBalance / LAMPORTS_PER_SOL;

        // If swapping SOL, we need: swap amount + fee buffer + small buffer for deposit transaction
        if (inputToken === "SOL") {
          const totalNeeded = inputAmountInTokenUnits + solForFees + 0.002; // Swap + fees + deposit tx fee
          if (currentSolBalanceInSol < totalNeeded) {
            toast.error("Insufficient SOL balance", {
              description: `You need ${totalNeeded.toFixed(6)} SOL (${inputAmountInTokenUnits.toFixed(6)} for swap + ${solForFees.toFixed(6)} for fees + 0.002 for transaction), but have ${currentSolBalanceInSol.toFixed(6)} SOL.`,
            });
            setIsLoading(false);
            return;
          }
        } else {
          // For non-SOL swaps, check token balance and SOL for fees
          if (publicBalance === null || publicBalance < amountInBaseUnits) {
            const tokenBalance = publicBalance ? (publicBalance / Math.pow(10, PRIVACY_CASH_TOKENS[inputToken].decimals)).toFixed(6) : "0";
            toast.error("Insufficient token balance", {
              description: `You need ${inputAmountInTokenUnits.toFixed(6)} ${inputToken}, but only have ${tokenBalance} ${inputToken}.`,
            });
            setIsLoading(false);
            return;
          }
          const solNeeded = solForFees + 0.002; // Fees + transaction fees
          if (currentSolBalanceInSol < solNeeded) {
            toast.error("Insufficient SOL for fees", {
              description: `You need ${solNeeded.toFixed(6)} SOL for fees, but only have ${currentSolBalanceInSol.toFixed(6)} SOL.`,
            });
            setIsLoading(false);
            return;
          }
        }

        // Step 1: Deposit public balance to Privacy Cash
        // For SOL swaps: Deposit swap amount + fees together (0.1 + 0.03 = 0.13 SOL)
        // For other tokens: Deposit token amount first, then SOL for fees separately
        const solNeededForFees = 0.03; // 0.03 SOL buffer for fees (will be returned after swap)

        if (inputToken === "SOL") {
          // For SOL swaps, deposit swap amount + fees in ONE transaction
          const totalSolToDeposit = inputAmountInTokenUnits + solNeededForFees;
          toast.loading(`Step 1/5: Depositing ${totalSolToDeposit.toFixed(6)} SOL (swap + fees) to Privacy Cash...`, { id: "swap" });
          setSwapStatus(`Step 1/5: Depositing ${totalSolToDeposit.toFixed(6)} SOL (swap + fees) to Privacy Cash`);
          const depositResult = await depositTokenToPrivacyCash(
            connection,
            publicKey,
            encryptionService,
            "SOL",
            totalSolToDeposit,
            async (tx: VersionedTransaction) => {
              if (!signTransaction) {
                throw new Error("Wallet does not support signing transactions. Please connect a compatible wallet.");
              }
              const sim = await connection.simulateTransaction(tx, { sigVerify: false });
              if (sim.value.err) {
                throw new Error(`Deposit simulation failed: ${JSON.stringify(sim.value.err)}. Please try again or reduce the amount.`);
              }
              return await signTransaction(tx);
            }
          );
          await connection.confirmTransaction(depositResult.tx, "confirmed");
        } else {
          // For non-SOL swaps, deposit token first, then SOL for fees
          toast.loading("Step 1/5: Depositing token to Privacy Cash...", { id: "swap" });
          setSwapStatus("Step 1/5: Depositing token to Privacy Cash");
          const depositResult = await depositTokenToPrivacyCash(
            connection,
            publicKey,
            encryptionService,
            inputToken,
            inputAmountInTokenUnits,
            async (tx: VersionedTransaction) => {
              if (!signTransaction) {
                throw new Error("Wallet does not support signing transactions. Please connect a compatible wallet.");
              }
              const sim = await connection.simulateTransaction(tx, { sigVerify: false });
              if (sim.value.err) {
                throw new Error(`Deposit simulation failed: ${JSON.stringify(sim.value.err)}. Please try again or reduce the amount.`);
              }
              return await signTransaction(tx);
            }
          );
          await connection.confirmTransaction(depositResult.tx, "confirmed");

          // Then deposit SOL for fees
          toast.loading("Depositing SOL for transaction fees...", { id: "swap" });
          setSwapStatus("Depositing SOL for transaction fees");
          const solDepositResult = await depositTokenToPrivacyCash(
            connection,
            publicKey,
            encryptionService,
            "SOL",
            solNeededForFees,
            async (tx: VersionedTransaction) => {
              if (!signTransaction) {
                throw new Error("Wallet does not support signing transactions. Please connect a compatible wallet.");
              }
              const sim = await connection.simulateTransaction(tx, { sigVerify: false });
              if (sim.value.err) {
                throw new Error(`Deposit simulation failed: ${JSON.stringify(sim.value.err)}. Please try again or reduce the amount.`);
              }
              return await signTransaction(tx);
            }
          );
          await connection.confirmTransaction(solDepositResult.tx, "confirmed");
        }

        // Step 2: Withdraw privately to ephemeral wallet
        toast.loading("Step 2/5: Withdrawing to ephemeral wallet...", { id: "swap" });
        setSwapStatus("Step 2/5: Withdrawing to ephemeral wallet");
        const ephemeralKeypair = deriveEphemeralWallet(signature);
        const ephemeralAddress = ephemeralKeypair.publicKey;

        // If swapping SOL, we already deposited swap amount + fees, so withdraw the full amount
        // If swapping other tokens, withdraw just the swap amount, then add fees separately
        // solForFees is already defined above (line 414)
        let amountToWithdraw = inputAmountInTokenUnits;

        if (inputToken === "SOL") {
          // For SOL swaps, withdraw swap amount + fees (we deposited both together)
          amountToWithdraw = roundedInputAmount + solForFees;
        }

        // Withdraw input token to ephemeral wallet
        const withdrawResult = await withdrawTokenFromPrivacyCash(
          connection,
          publicKey,
          encryptionService,
          inputToken,
          amountToWithdraw,
          ephemeralAddress
        );

        toast.loading("Waiting for withdrawal confirmation...", { id: "swap" });
        await connection.confirmTransaction(withdrawResult.tx, "confirmed");

        // For non-SOL swaps, ensure ephemeral wallet has SOL for fees
        if (inputToken !== "SOL") {
          const ephemeralBalance = await connection.getBalance(ephemeralAddress);
          const solNeeded = solForFees * 1e9;

          if (ephemeralBalance < solNeeded) {
            toast.loading("Funding ephemeral wallet with SOL for fees...", { id: "swap" });
            setSwapStatus("Funding ephemeral wallet with SOL for fees");
            const solToWithdraw = (solNeeded - ephemeralBalance) / 1e9;

            if (solToWithdraw > 0) {
              try {
                // Try to withdraw from private pool first
                const solWithdrawResult = await withdrawTokenFromPrivacyCash(
                  connection,
                  publicKey,
                  encryptionService,
                  "SOL",
                  solToWithdraw,
                  ephemeralAddress
                );
                await connection.confirmTransaction(solWithdrawResult.tx, "confirmed");
              } catch (error: any) {
                // If private pool doesn't have SOL, use public wallet directly
                if (error.message?.includes("unspent UTXO") || error.message?.includes("no balance")) {
                  toast.loading("Using public wallet SOL to fund ephemeral wallet...", { id: "swap" });
                  const publicSolBalance = await connection.getBalance(publicKey);
                  const solNeededLamports = solNeeded - ephemeralBalance;

                  if (publicSolBalance < solNeededLamports) {
                    throw new Error(
                      `Insufficient SOL in public wallet. Need ${(solNeededLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL for fees, ` +
                      `but only have ${(publicSolBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL.`
                    );
                  }

                  // Transfer directly from public wallet to ephemeral wallet
                  const fundTx = new Transaction().add(
                    SystemProgram.transfer({
                      fromPubkey: publicKey,
                      toPubkey: ephemeralAddress,
                      lamports: solNeededLamports,
                    })
                  );

                  const { blockhash: fundBlockhash } = await connection.getLatestBlockhash("confirmed");
                  fundTx.recentBlockhash = fundBlockhash;
                  fundTx.feePayer = publicKey;

                  const fundSim = await connection.simulateTransaction(fundTx);
                  if (fundSim.value.err) {
                    throw new Error(`Funding transaction simulation failed: ${JSON.stringify(fundSim.value.err)}. Cannot safely proceed.`);
                  }
                  const signedFundTx = await signTransaction(fundTx);
                  const fundSignature = await connection.sendRawTransaction(signedFundTx.serialize(), {
                    skipPreflight: false,
                    maxRetries: 3,
                  });
                  await connection.confirmTransaction(fundSignature, "confirmed");
                } else {
                  throw error;
                }
              }
            }
          }
        }

        // Step 3: Get quote and swap from ephemeral wallet
        toast.loading("Step 3/5: Getting swap quote...", { id: "swap" });
        setSwapStatus("Step 3/5: Getting swap quote");
        const quote = await jupiterAPI.getQuote({
          inputMint: PRIVACY_CASH_TOKENS[inputToken].mint,
          outputMint: PRIVACY_CASH_TOKENS[outputToken].mint,
          amount: amountInBaseUnits,
          slippageBps: 50,
          platformFeeBps: PLATFORM_FEE_BPS,
        });

        toast.loading("Building swap transaction...", { id: "swap" });
        setSwapStatus("Building swap transaction");
        const outputMintForFee = new PublicKey(PRIVACY_CASH_TOKENS[outputToken].mint);
        const feeAccount = await getAssociatedTokenAddress(outputMintForFee, PLATFORM_FEE_WALLET);
        const swapResponse = await jupiterAPI.buildSwapTransaction({
          quoteResponse: quote,
          userPublicKey: ephemeralAddress, // Swap from ephemeral wallet
          wrapUnwrapSOL: true,
          dynamicComputeUnitLimit: true,
          feeAccount: feeAccount.toBase58(),
        });

        toast.loading("Executing swap from ephemeral wallet...", { id: "swap" });
        setSwapStatus("Executing swap from ephemeral wallet");
        const swapTransaction = VersionedTransaction.deserialize(
          Buffer.from(swapResponse.swapTransaction, "base64")
        );
        swapTransaction.sign([ephemeralKeypair]);

        // Verify ephemeral wallet has enough balance before sending
        const finalEphemeralBalance = await connection.getBalance(ephemeralAddress);
        const finalEphemeralBalanceSol = finalEphemeralBalance / LAMPORTS_PER_SOL;

        // Simulate transaction first to catch errors early
        try {
          const simulation = await connection.simulateTransaction(swapTransaction, {
            replaceRecentBlockhash: true,
            sigVerify: false,
          });

          if (simulation.value.err) {
            const errorMsg = JSON.stringify(simulation.value.err);
            const hint6025 = errorMsg.includes("6025") ? " Jupiter 6025 (InvalidTokenAccount): ensure the platform fee ATA for the output mint is initialized." : "";
            throw new Error(`Swap simulation failed: ${errorMsg}. Ephemeral wallet balance: ${finalEphemeralBalanceSol.toFixed(6)} SOL.${hint6025}`);
          }

          // Check if we have enough SOL for the transaction fee
          // SimulatedTransactionResponse does not include an explicit fee field,
          // so we use a conservative static estimate in lamports.
          const estimatedFee = 5000; // ~0.000005 SOL
          if (finalEphemeralBalance < estimatedFee) {
            throw new Error(
              `Insufficient SOL for transaction fees. Ephemeral wallet has ${finalEphemeralBalanceSol.toFixed(6)} SOL, ` +
              `but needs at least ${(estimatedFee / LAMPORTS_PER_SOL).toFixed(6)} SOL for fees.`
            );
          }
        } catch (simError: any) {
          if (simError.message?.includes("simulation") || simError.message?.includes("Insufficient") || simError.message?.includes("6025")) {
            throw simError; // Re-throw simulation errors
          }
          console.warn("Simulation check failed, proceeding anyway:", simError);
        }

        const swapSignature = await connection.sendRawTransaction(
          swapTransaction.serialize(),
          {
            skipPreflight: false, // Preflight will catch most errors
            maxRetries: 3,
          }
        );

        // Wait for confirmation with better error handling
        try {
          const { blockhash: swapBlockhash, lastValidBlockHeight: swapLastValidBlockHeight } =
            await connection.getLatestBlockhash("confirmed");

          const confirmation = await Promise.race([
            connection.confirmTransaction(
              {
                signature: swapSignature,
                blockhash: swapBlockhash,
                lastValidBlockHeight: swapLastValidBlockHeight,
              },
              "confirmed"
            ),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("TIMEOUT")), 60000) // 60 second timeout
            )
          ]) as any;

          if (confirmation.value?.err) {
            throw new Error(`Swap transaction failed: ${JSON.stringify(confirmation.value.err)}`);
          }
        } catch (error: any) {
          // If confirmation times out, check if transaction actually succeeded
          if (error.message === "TIMEOUT" || error.message?.includes("not confirmed")) {
            toast.loading("Confirmation timed out, checking transaction status...", { id: "swap" });
            // Check transaction status directly
            const txStatus = await connection.getSignatureStatus(swapSignature);
            if (txStatus.value?.err) {
              throw new Error(`Swap transaction failed: ${JSON.stringify(txStatus.value.err)}`);
            } else if (txStatus.value && (txStatus.value.confirmationStatus === "confirmed" || txStatus.value.confirmationStatus === "finalized")) {
              // Transaction actually succeeded
              toast.success("Swap confirmed!", {
                id: "swap",
                description: `Transaction: ${swapSignature.slice(0, 8)}...`,
              });
            } else {
              // Transaction status unknown - provide helpful error
              throw new Error(
                `Transaction confirmation timed out. The swap may still be processing. ` +
                `Check status: https://solscan.io/tx/${swapSignature}. ` +
                `If the swap succeeded, you can recover any remaining SOL from the ephemeral wallet.`
              );
            }
          } else {
            throw error;
          }
        }

        // Step 4: Deposit output directly from ephemeral wallet to Privacy Cash
        // Check ACTUAL balance in ephemeral wallet (handles slippage/fees)
        toast.loading("Step 4/5: Checking actual balance in ephemeral wallet...", { id: "swap" });
        setSwapStatus("Step 4/5: Checking actual balance in ephemeral wallet");
        const outputDecimals = PRIVACY_CASH_TOKENS[outputToken].decimals;
        const tokenInfo = PRIVACY_CASH_TOKENS[outputToken];

        let actualBalanceInBaseUnits: number;
        if (outputToken === "SOL") {
          // For SOL, check SOL balance
          actualBalanceInBaseUnits = await connection.getBalance(ephemeralAddress);
        } else {
          // For SPL tokens, check token account balance
          const { getAssociatedTokenAddress, getAccount } = await import("@solana/spl-token");
          const ephemeralTokenAccount = await getAssociatedTokenAddress(
            new PublicKey(tokenInfo.mint),
            ephemeralAddress
          );
          try {
            const accountInfo = await getAccount(connection, ephemeralTokenAccount);
            actualBalanceInBaseUnits = Number(accountInfo.amount);
          } catch {
            throw new Error(`Output token ${outputToken} not found in ephemeral wallet. Swap may have failed.`);
          }
        }

        // Convert to token units and round
        let outputAmountInTokenUnits = actualBalanceInBaseUnits / Math.pow(10, outputDecimals);
        outputAmountInTokenUnits = Math.round(outputAmountInTokenUnits * Math.pow(10, outputDecimals)) / Math.pow(10, outputDecimals);

        // Validate output amount before attempting deposit
        if (!outputAmountInTokenUnits || outputAmountInTokenUnits <= 0) {
          throw new Error(`Invalid output amount: ${outputAmountInTokenUnits}. Swap may have failed.`);
        }

        // Deposit using ACTUAL balance (handles slippage automatically)
        toast.loading(`Step 4/5: Depositing ${outputAmountInTokenUnits.toFixed(6)} ${outputToken} to Privacy Cash...`, { id: "swap" });
        setSwapStatus(`Step 4/5: Depositing ${outputToken} to Privacy Cash`);

        const outputDepositResult = await depositTokenToPrivacyCash(
          connection,
          publicKey,
          encryptionService,
          outputToken,
          outputAmountInTokenUnits,
          async (tx: VersionedTransaction) => {
            // Sign with ephemeral wallet keypair (tokens are in ephemeral wallet)
            tx.sign([ephemeralKeypair]);
            return tx;
          },
          ephemeralAddress // Pass ephemeral wallet as signer to use its token account
        );

        toast.loading("Waiting for output deposit confirmation...", { id: "swap" });
        setSwapStatus("Waiting for output deposit confirmation");
        await connection.confirmTransaction(outputDepositResult.tx, "confirmed");

        // Step 5: Withdraw output back to public wallet (user receives it)
        toast.loading("Step 5/5: Withdrawing output to your wallet...", { id: "swap" });
        setSwapStatus("Step 5/5: Withdrawing output to your wallet");
        const finalWithdrawResult = await withdrawTokenFromPrivacyCash(
          connection,
          publicKey,
          encryptionService,
          outputToken,
          outputAmountInTokenUnits,
          publicKey // Withdraw to user's own wallet
        );

        toast.loading("Waiting for final withdrawal confirmation...", { id: "swap" });
        setSwapStatus("Waiting for final withdrawal confirmation");
        await connection.confirmTransaction(finalWithdrawResult.tx, "confirmed");

        // Return remaining SOL from ephemeral wallet to user's public wallet
        try {
          const remainingBalance = await connection.getBalance(ephemeralAddress);
          const minReserve = 5000; // Keep 0.000005 SOL as minimum reserve (dust)
          const solToReturn = (remainingBalance - minReserve) / 1e9; // Convert to SOL

          if (solToReturn > 0.001) { // Only return if more than 0.001 SOL (worth the transaction fee)
            toast.loading("Returning remaining SOL to your wallet...", { id: "swap" });
            setSwapStatus("Returning remaining SOL to your wallet");

            const returnTx = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: ephemeralAddress,
                toPubkey: publicKey,
                lamports: remainingBalance - minReserve,
              })
            );

            const latestBlockhash = await connection.getLatestBlockhash();
            returnTx.recentBlockhash = latestBlockhash.blockhash;
            returnTx.feePayer = ephemeralAddress;
            returnTx.sign(ephemeralKeypair);

            const returnSignature = await connection.sendRawTransaction(returnTx.serialize(), {
              skipPreflight: false,
              maxRetries: 3,
            });
            await connection.confirmTransaction(returnSignature, "confirmed");
          }
        } catch (error) {
          // Don't fail the swap if returning SOL fails - just log it
          console.warn("Failed to return remaining SOL from ephemeral wallet:", error);
        }

        toast.success("Private swap completed!", {
          id: "swap",
          description: `All steps completed. You received ${outputAmountInTokenUnits.toFixed(6)} ${outputToken} in your wallet.`,
          action: {
            label: "View Swap",
            onClick: () => window.open(`https://solscan.io/tx/${swapSignature}`, "_blank"),
          },
        });
        setSwapStatus("Private swap completed");
        if (publicKey) {
          const priceUsd = await getTokenPriceUsd(PRIVACY_CASH_TOKENS[outputToken].mint);
          const volumeUsd = outputAmountInTokenUnits * priceUsd;
          awardPointsForSwap(publicKey.toBase58(), swapSignature, volumeUsd);
        }
      } else {
        toast.error("Insufficient balance", {
          description: "Please ensure you have enough tokens",
        });
      }

      // Reset form
      setInputAmount("");
      setOutputAmount("");
      setPriceImpact(null);

      // Refresh balances after a short delay to allow blockchain state to update
      setTimeout(async () => {
        if (balanceCheckInProgress.current) return;
        balanceCheckInProgress.current = true;

        try {
          if (publicKey) {
            const pubBalance = await getPublicTokenBalance(connection, publicKey, inputToken);
            setPublicBalance(pubBalance);
          }

          if (encryptionService && publicKey && privacyCashInitialized) {
            const privBalance = await getPrivateTokenBalanceDirect(
              connection,
              publicKey,
              encryptionService,
              inputToken
            );
            setPrivateBalance(privBalance);
            setHasPrivateInputBalance(privBalance > 0);
          }
        } catch (error) {
          console.error("Failed to refresh balances:", error);
        } finally {
          balanceCheckInProgress.current = false;
        }
      }, 2000); // Wait 2 seconds for blockchain state to update
    } catch (error: any) {
      console.error("Swap error:", error);
      toast.error("Swap failed", {
        id: "swap",
        description: error.message || "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
      // Keep the last status visible so user can see what happened
    }
  };

  const swapTokens = () => {
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
    const tempAmount = inputAmount;
    setInputAmount(outputAmount);
    setOutputAmount(tempAmount);
  };

  // Check ephemeral wallet balance (SOL and tokens)
  const checkEphemeralBalance = useCallback(async () => {
    if (!publicKey || !connected || !signature) {
      toast.error("Please connect wallet and sign in to Privacy Cash");
      return;
    }

    setIsCheckingEphemeral(true);
    try {
      // Check SOL balance
      const balanceInfo = await checkEphemeralWalletBalance(connection, publicKey);
      setEphemeralBalance(balanceInfo.solBalance);
      setEphemeralAddress(balanceInfo.address);

      // Check token balances (excluding SOL)
      const tokenBalances: Record<PrivacyCashToken, number> = {} as Record<PrivacyCashToken, number>;
      const tokensToCheck: PrivacyCashToken[] = ["USDC", "USDT", "ZEC", "ORE", "STORE"];

      for (const token of tokensToCheck) {
        try {
          const tokenBalanceInfo = await checkEphemeralTokenBalance(connection, publicKey, token);
          tokenBalances[token] = tokenBalanceInfo.balanceInUnits;
        } catch {
          tokenBalances[token] = 0;
        }
      }

      setEphemeralTokenBalances(tokenBalances);

      const hasSOL = balanceInfo.solBalance > 0;
      const hasTokens = Object.values(tokenBalances).some(bal => bal > 0);

      if (hasSOL || hasTokens) {
        const foundItems: string[] = [];
        if (hasSOL) foundItems.push(`${balanceInfo.solBalance.toFixed(6)} SOL`);
        Object.entries(tokenBalances).forEach(([token, bal]) => {
          if (bal > 0) foundItems.push(`${bal.toFixed(6)} ${token}`);
        });

        toast.success(`Found in ephemeral wallet: ${foundItems.join(", ")}`, {
          description: `Address: ${balanceInfo.address.slice(0, 8)}...`,
        });
      } else {
        toast.info("No funds found in ephemeral wallet");
      }
    } catch (error: any) {
      console.error("Failed to check ephemeral balance:", error);
      toast.error("Failed to check ephemeral wallet", {
        description: error.message || "Unknown error",
      });
    } finally {
      setIsCheckingEphemeral(false);
    }
  }, [publicKey, connected, signature, connection]);

  // Recover SOL from ephemeral wallet
  const recoverEphemeralFunds = useCallback(async () => {
    if (!publicKey || !connected || !signature) {
      toast.error("Please connect wallet and sign in to Privacy Cash");
      return;
    }

    if (ephemeralBalance === null || ephemeralBalance <= 0) {
      toast.error("No funds to recover. Please check balance first.");
      return;
    }

    setIsRecovering(true);
    try {
      toast.loading("Recovering SOL from ephemeral wallet...", { id: "recover" });
      const txSignature = await recoverSOLFromEphemeralWallet(connection, publicKey);

      toast.success("Funds recovered successfully!", {
        id: "recover",
        description: `Recovered ${ephemeralBalance.toFixed(6)} SOL. Transaction: ${txSignature.slice(0, 8)}...`,
        action: {
          label: "View",
          onClick: () => window.open(`https://solscan.io/tx/${txSignature}`, "_blank"),
        },
      });

      // Refresh balance
      setEphemeralBalance(0);
      await checkEphemeralBalance();
    } catch (error: any) {
      console.error("Failed to recover funds:", error);
      toast.error("Failed to recover funds", {
        id: "recover",
        description: error.message || "Unknown error",
      });
    } finally {
      setIsRecovering(false);
    }
  }, [publicKey, connected, signature, connection, ephemeralBalance, checkEphemeralBalance]);

  // Recover token from ephemeral wallet
  const recoverToken = useCallback(async (token: PrivacyCashToken) => {
    if (!publicKey || !connected || !signature) {
      toast.error("Please connect wallet and sign in to Privacy Cash");
      return;
    }

    const tokenBalance = ephemeralTokenBalances[token];
    if (!tokenBalance || tokenBalance <= 0) {
      toast.error(`No ${token} to recover. Please check balance first.`);
      return;
    }

    setIsRecoveringToken(token);
    try {
      toast.loading(`Recovering ${token} from ephemeral wallet...`, { id: `recover-${token}` });
      const txSignature = await recoverTokenFromEphemeralWallet(connection, publicKey, token);

      toast.success(`${token} recovered successfully!`, {
        id: `recover-${token}`,
        description: `Recovered ${tokenBalance.toFixed(6)} ${token}. Transaction: ${txSignature.slice(0, 8)}...`,
        action: {
          label: "View",
          onClick: () => window.open(`https://solscan.io/tx/${txSignature}`, "_blank"),
        },
      });

      // Refresh balance
      await checkEphemeralBalance();
    } catch (error: any) {
      console.error(`Failed to recover ${token}:`, error);
      toast.error(`Failed to recover ${token}`, {
        id: `recover-${token}`,
        description: error.message || "Unknown error",
      });
    } finally {
      setIsRecoveringToken(null);
    }
  }, [publicKey, connected, signature, connection, ephemeralTokenBalances, checkEphemeralBalance]);

  // Auto-check ephemeral balance once when wallet connects and Privacy Cash is initialized
  const hasCheckedEphemeral = useRef(false);
  useEffect(() => {
    if (connected && publicKey && signature && privacyCashInitialized && !hasCheckedEphemeral.current) {
      hasCheckedEphemeral.current = true;
      checkEphemeralBalance();
    }
    // Reset when wallet disconnects
    if (!connected) {
      hasCheckedEphemeral.current = false;
    }
  }, [connected, publicKey, signature, privacyCashInitialized, checkEphemeralBalance]);

  return (
    <Card className="w-full max-w-6xl border border-black bg-white shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-black">
          <ArrowLeftRight className="h-5 w-5" />
          Swap Privately
        </CardTitle>
        <CardDescription className="text-gray-600">
          Swap between tokens using Jupiter routing
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {!connected && (
          <div className="text-center py-8 text-gray-600">
            Please connect your wallet to continue
          </div>
        )}

        {connected && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Column: Input Token */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-black">From</label>
                <select
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value as PrivacyCashToken)}
                  className="w-full px-3 py-2 bg-white border border-black rounded-md text-black focus:outline-none focus:ring-2 focus:ring-black"
                >
                  {PRIVACY_CASH_TOKEN_LIST.map((token) => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.000001"
                  min="0"
                  className="w-full px-3 py-2 bg-white border border-black rounded-md text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Balance Display */}
              <div className="space-y-1 text-xs">
                {publicBalance !== null && publicBalance > 0 && (
                  <div className="text-gray-600">
                    Wallet: {(publicBalance / Math.pow(10, PRIVACY_CASH_TOKENS[inputToken].decimals)).toFixed(6)}
                  </div>
                )}
                {privateBalance !== null && privateBalance > 0 && (
                  <div className="text-gray-600">
                    Private: {(privateBalance / Math.pow(10, PRIVACY_CASH_TOKENS[inputToken].decimals)).toFixed(6)}
                  </div>
                )}
              </div>
            </div>

            {/* Middle Column: Swap Arrow */}
            <div className="flex items-center justify-center">
              <button
                onClick={swapTokens}
                className="p-3 bg-white border-2 border-black rounded-full hover:bg-gray-100 transition-colors"
              >
                <ArrowDownUp className="h-5 w-5 text-black" />
              </button>
            </div>

            {/* Right Column: Output Token */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-black">To</label>
                <select
                  value={outputToken}
                  onChange={(e) => setOutputToken(e.target.value as PrivacyCashToken)}
                  className="w-full px-3 py-2 bg-white border border-black rounded-md text-black focus:outline-none focus:ring-2 focus:ring-black"
                >
                  {PRIVACY_CASH_TOKEN_LIST.map((token) => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
                <div className="w-full px-3 py-2 bg-gray-100 border border-black rounded-md text-black flex items-center">
                  {isGettingQuote ? (
                    <Loader2 className="h-4 w-4 animate-spin text-black" />
                  ) : (
                    outputAmount || "0.00"
                  )}
                </div>
              </div>

              {/* Price Impact */}
              {priceImpact && parseFloat(priceImpact) > 0 && (
                <div className="text-xs text-gray-600">
                  Price Impact: {parseFloat(priceImpact).toFixed(2)}%
                </div>
              )}
            </div>

            {/* Action Column: Swap Button & Settings */}
            <div className="lg:col-span-2 space-y-4">
              {/* Private Mode Toggle */}
              {privacyCashInitialized && (
                <div className="p-3 bg-gray-100 border border-black rounded-md">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="private-mode"
                      checked={enablePrivateMode}
                      onChange={(e) => setEnablePrivateMode(e.target.checked)}
                      className="w-4 h-4 rounded border-black bg-white text-black focus:ring-black"
                    />
                    <label htmlFor="private-mode" className="text-sm text-black cursor-pointer">
                      Enable Private Swap
                    </label>
                  </div>
                </div>
              )}

              {/* Swap Button */}
              <Button
                onClick={handleSwap}
                disabled={isLoading || !inputAmount || parseFloat(inputAmount) <= 0 || !outputAmount}
                className="w-full bg-black text-white hover:bg-gray-900 border border-black"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Swapping...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Swap
                  </>
                )}
              </Button>

              {/* Inline Swap Status */}
              {swapStatus && (
                <div className="mt-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                  <span className="font-semibold text-black">Current step:</span>{" "}
                  <span>{swapStatus}</span>
                </div>
              )}

              {/* Info */}
              <div className="text-xs text-gray-600 space-y-1">
                <p>• Powered by Jupiter for optimal routing</p>
                <p>• Slippage tolerance: 0.5%</p>
                <p>• Network fees apply</p>
              </div>
            </div>
          </div>
        )}

        {/* Additional sections below */}
        {connected && (
          <>

            {/* Sign In Section */}
            {!privacyCashInitialized && (
              <div className="mt-6 p-4 bg-gray-100 border border-black rounded-md">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-black">
                    ⚠️ Sign in to Privacy Cash to enable private swaps
                  </div>
                  <Button
                    onClick={async () => {
                      if (isInitializing) return;
                      setIsInitializing(true);
                      try {
                        await initializeEncryption();
                        toast.success("Privacy Cash initialized successfully!");
                      } catch (error: any) {
                        console.error("Failed to initialize Privacy Cash:", error);
                        toast.error("Failed to sign in to Privacy Cash", {
                          description: error.message || "Please approve the signature request in your wallet",
                        });
                      } finally {
                        setIsInitializing(false);
                      }
                    }}
                    disabled={isInitializing}
                    size="sm"
                    className="bg-black text-white hover:bg-gray-900 border border-black"
                  >
                    {isInitializing ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Recover Funds Section */}
            {privacyCashInitialized && connected && (
              <div className="mt-6 p-4 bg-gray-100 border border-black rounded-md">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-black" />
                    <span className="text-sm font-medium text-black">Recover Stuck Funds</span>
                  </div>
                  <Button
                    onClick={checkEphemeralBalance}
                    disabled={isCheckingEphemeral}
                    size="sm"
                    variant="outline"
                    className="border-black text-black hover:bg-gray-200 bg-white"
                  >
                    {isCheckingEphemeral ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      "Check Balance"
                    )}
                  </Button>
                </div>

                {(ephemeralBalance !== null || Object.keys(ephemeralTokenBalances).length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* SOL Recovery */}
                    {ephemeralBalance !== null && ephemeralBalance > 0 && (
                      <div className="space-y-2 p-3 bg-white rounded border border-black">
                        <div className="text-xs text-black">
                          <span className="font-bold">{ephemeralBalance.toFixed(6)} SOL</span> in ephemeral wallet
                        </div>
                        {ephemeralAddress && (
                          <div className="text-xs text-gray-600 font-mono break-all">
                            {ephemeralAddress}
                          </div>
                        )}
                        <Button
                          onClick={recoverEphemeralFunds}
                          disabled={isRecovering || ephemeralBalance <= 0 || ephemeralBalance < 0.0001}
                          size="sm"
                          className="w-full bg-black text-white hover:bg-gray-900 border border-black"
                        >
                          {isRecovering ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Recovering...
                            </>
                          ) : (
                            <>
                              <Wallet className="h-3 w-3 mr-1" />
                              Recover {Math.max(0, ephemeralBalance - 0.0001).toFixed(6)} SOL
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Token Recovery */}
                    {Object.entries(ephemeralTokenBalances).map(([token, balance]) => {
                      if (balance <= 0) return null;
                      return (
                        <div key={token} className="space-y-2 p-3 bg-white rounded border border-black">
                          <div className="text-xs text-black">
                            <span className="font-bold">{balance.toFixed(6)} {token}</span> in ephemeral wallet
                          </div>
                          <Button
                            onClick={() => recoverToken(token as PrivacyCashToken)}
                            disabled={isRecoveringToken === token || balance <= 0}
                            size="sm"
                            className="w-full bg-black text-white hover:bg-gray-900 border border-black"
                          >
                            {isRecoveringToken === token ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Recovering...
                              </>
                            ) : (
                              <>
                                <Wallet className="h-3 w-3 mr-1" />
                                Recover {balance.toFixed(6)} {token}
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })}

                    {ephemeralBalance === 0 && Object.values(ephemeralTokenBalances).every(bal => bal === 0) && (
                      <div className="text-xs text-gray-600">
                        No funds found in ephemeral wallet
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
