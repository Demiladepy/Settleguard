"use client";

import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

// Jupiter API - Metis Swap API (requires API key)
// Get free API key from: https://portal.jup.ag
// Free tier: 60 requests per minute
// Documentation: https://dev.jup.ag/docs/swap/get-quote
const JUPITER_API_BASE = "https://api.jup.ag/swap/v1";

const JUPITER_PRICE_BASE = "https://api.jup.ag/price/v3";

/**
 * Get Jupiter API key from environment variable
 */
function getJupiterApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return process.env.NEXT_PUBLIC_JUPITER_API_KEY || null;
}

/**
 * Fetch USD price for a token mint from Jupiter Price API v3.
 * Returns price per token (e.g. 200 for SOL) or 0 if unavailable.
 */
export async function getTokenPriceUsd(mint: string): Promise<number> {
  const headers: HeadersInit = {};
  const apiKey = getJupiterApiKey();
  if (apiKey) headers["x-api-key"] = apiKey;
  const res = await fetch(`${JUPITER_PRICE_BASE}?ids=${encodeURIComponent(mint)}`, { headers });
  if (!res.ok) return 0;
  const data = (await res.json()) as Record<string, { usdPrice?: number } | undefined>;
  const entry = data[mint];
  return entry?.usdPrice ?? 0;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterSwapResponse {
  swapTransaction: string; // base64 encoded transaction
}

export class JupiterAPI {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get a quote for swapping tokens
   */
  async getQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: number; // in base units (lamports for SOL)
    slippageBps?: number; // slippage in basis points (default: 50 = 0.5%)
    onlyDirectRoutes?: boolean;
    asLegacyTransaction?: boolean;
    platformFeeBps?: number; // platform fee in basis points (optional)
  }): Promise<JupiterQuoteResponse> {
    const {
      inputMint,
      outputMint,
      amount,
      slippageBps = 50,
      onlyDirectRoutes = false,
      asLegacyTransaction = false,
      platformFeeBps,
    } = params;

    const url = new URL(`${JUPITER_API_BASE}/quote`);
    url.searchParams.append("inputMint", inputMint);
    url.searchParams.append("outputMint", outputMint);
    url.searchParams.append("amount", amount.toString());
    url.searchParams.append("slippageBps", slippageBps.toString());
    url.searchParams.append("onlyDirectRoutes", onlyDirectRoutes.toString());
    url.searchParams.append("asLegacyTransaction", asLegacyTransaction.toString());
    
    // Add platform fee if provided
    if (platformFeeBps !== undefined) {
      url.searchParams.append("platformFeeBps", platformFeeBps.toString());
    }

    // Add API key header (required for api.jup.ag)
    const headers: HeadersInit = {};
    const apiKey = getJupiterApiKey();
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    } else {
      console.warn("⚠️ Jupiter API key not found. Get a free API key from https://portal.jup.ag");
    }

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jupiter API error: ${error}`);
    }

    return response.json();
  }

  /**
   * Build a swap transaction from a quote
   */
  async buildSwapTransaction(params: {
    quoteResponse: JupiterQuoteResponse;
    userPublicKey: PublicKey;
    wrapUnwrapSOL?: boolean;
    feeAccount?: string;
    trackingAccount?: string;
    computeUnitPriceMicroLamports?: string;
    asLegacyTransaction?: boolean;
    dynamicComputeUnitLimit?: boolean;
    prioritizationFeeLamports?: string;
  }): Promise<JupiterSwapResponse> {
    const {
      quoteResponse,
      userPublicKey,
      wrapUnwrapSOL = true,
      asLegacyTransaction = false,
      dynamicComputeUnitLimit = true,
    } = params;

    const payload = {
      quoteResponse,
      userPublicKey: userPublicKey.toString(),
      wrapUnwrapSOL,
      asLegacyTransaction,
      dynamicComputeUnitLimit,
      ...(params.feeAccount && { feeAccount: params.feeAccount }),
      ...(params.trackingAccount && { trackingAccount: params.trackingAccount }),
      ...(params.computeUnitPriceMicroLamports && {
        computeUnitPriceMicroLamports: params.computeUnitPriceMicroLamports,
      }),
      ...(params.prioritizationFeeLamports && {
        prioritizationFeeLamports: params.prioritizationFeeLamports,
      }),
    };

    // Add API key header (required for api.jup.ag)
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    const apiKey = getJupiterApiKey();
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    } else {
      console.warn("⚠️ Jupiter API key not found. Get a free API key from https://portal.jup.ag");
    }

    const response = await fetch(`${JUPITER_API_BASE}/swap`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jupiter swap build error: ${error}`);
    }

    return response.json();
  }

  /**
   * Execute a swap transaction
   */
  async executeSwap(
    swapTransaction: string, // base64 encoded
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction> // signTransaction function from useWallet()
  ): Promise<string> {
    // Deserialize the transaction
    const transactionBuf = Buffer.from(swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(transactionBuf);

    // Sign the transaction using the signTransaction function from useWallet()
    if (!signTransaction) {
      throw new Error("Wallet does not support signing transactions. Please ensure your wallet is connected and supports transaction signing.");
    }

    // Get fresh blockhash info for confirmation
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash("confirmed");

    // Sign the transaction (with original blockhash - it should still be valid if we act quickly)
    const signedTransaction = await signTransaction(transaction);

    // Try to send the transaction
    // If blockhash expired, we'll catch the error and provide helpful message
    let signature: string;
    try {
      signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
    } catch (error: unknown) {
      // If blockhash expired, provide helpful error message
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Blockhash not found") || message.includes("blockhash")) {
        throw new Error(
          "Transaction blockhash expired. This can happen if there was a delay in wallet approval. " +
          "Please try the swap again - the blockhash will be refreshed automatically."
        );
      }
      throw error;
    }

    // Wait for confirmation
    const confirmation = await this.connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      "confirmed"
    );
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    return signature;
  }

  /**
   * Get token list
   */
  async getTokens(): Promise<unknown[]> {
    const response = await fetch("https://token.jup.ag/all");
    if (!response.ok) {
      throw new Error("Failed to fetch token list");
    }
    return response.json();
  }
}
