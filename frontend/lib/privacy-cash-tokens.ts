/**
 * Privacy Cash Supported Tokens
 * These are the tokens that can be used for private transactions
 */

export type PrivacyCashToken = "SOL" | "USDC" | "USDT" | "ZEC" | "ORE" | "STORE";

export const PRIVACY_CASH_TOKENS: Record<
  PrivacyCashToken,
  { mint: string; decimals: number; name: string }
> = {
  SOL: {
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    name: "Solana",
  },
  USDC: {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    name: "USD Coin",
  },
  USDT: {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
    name: "Tether",
  },
  ZEC: {
    mint: "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS",
    decimals: 8,
    name: "Zcash",
  },
  ORE: {
    mint: "oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp",
    decimals: 11,
    name: "ORE",
  },
  STORE: {
    mint: "sTorERYB6xAZ1SSbwpK3zoK2EEwbBrc7TZAzg1uCGiH",
    decimals: 11,
    name: "STORE",
  },
};

export const PRIVACY_CASH_TOKEN_LIST: Array<{
  symbol: PrivacyCashToken;
  mint: string;
  decimals: number;
  name: string;
}> = Object.entries(PRIVACY_CASH_TOKENS).map(([symbol, data]) => ({
  symbol: symbol as PrivacyCashToken,
  ...data,
}));
