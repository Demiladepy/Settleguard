"use client";

import React, { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  LedgerWalletAdapter,
} from "@solana/wallet-adapter-wallets";

// Import the wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

interface SolanaProviderProps {
  children: ReactNode;
}

export const SolanaProvider: FC<SolanaProviderProps> = ({ children }) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'
  const network = WalletAdapterNetwork.Mainnet;

  // Use custom RPC endpoint from environment variable, or fall back to public endpoint
  // For production, use a paid RPC provider like Helius, QuickNode, or Alchemy
  // Example: https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
  // Note: NEXT_PUBLIC_ prefix makes env vars available in the browser (embedded at build time)
  const endpoint = useMemo(() => {
    // Check for custom RPC endpoint in environment variable
    // In Next.js, NEXT_PUBLIC_ vars are available in client components
    const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (customRpc && customRpc.trim() !== "") {
      return customRpc.trim();
    }
    // Fall back to public endpoint (may have rate limits and 403 errors)
    console.warn(
      "⚠️ Using public Solana RPC endpoint. For better reliability, set NEXT_PUBLIC_SOLANA_RPC_URL in .env.local"
    );
    return clusterApiUrl(network);
  }, [network]);

  // Configure wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
