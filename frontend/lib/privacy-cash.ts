/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */

"use client";

import { EncryptionService } from "privacycash/utils";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";

export interface Signed {
  publicKey: PublicKey;
  signature?: Uint8Array;
  provider: any;
}

export function usePrivacyCash() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [encryptionService, setEncryptionService] = useState<EncryptionService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [signature, setSignature] = useState<Uint8Array | null>(null);

  // Derive encryption key from signature
  const initializeEncryption = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signMessage) {
      throw new Error("Wallet not connected");
    }

    try {
      const encodedMessage = new TextEncoder().encode(`Privacy Money account sign in`);
      const cacheKey = `zkcash-signature-${wallet.publicKey.toBase58()}`;

      // Check cache
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const cachedSig = JSON.parse(cached);
        const sig = new Uint8Array(Object.values(cachedSig));
        const encryptionService = new EncryptionService();
        encryptionService.deriveEncryptionKeyFromSignature(sig);
        setEncryptionService(encryptionService);
        setSignature(sig);
        setIsInitialized(true);
        return;
      }

      // Ask for signature
      let signature: Uint8Array;
      try {
        const sig = await wallet.signMessage(encodedMessage);
        // @ts-ignore
        signature = sig.signature || sig;
      } catch (err: any) {
        if (err.message?.toLowerCase().includes("user rejected")) {
          throw new Error("User rejected the signature request");
        }
        throw new Error("Failed to sign message: " + err.message);
      }

      if (!(signature instanceof Uint8Array)) {
        throw new Error("signature is not an Uint8Array type");
      }

      // Cache signature
      localStorage.setItem(cacheKey, JSON.stringify(Array.from(signature)));

      // Derive encryption key
      const encryptionService = new EncryptionService();
      encryptionService.deriveEncryptionKeyFromSignature(signature);
      setEncryptionService(encryptionService);
      setSignature(signature);
      setIsInitialized(true);
    } catch (error: any) {
      console.error("Failed to initialize encryption:", error);
      throw error;
    }
  }, [wallet]);

  return {
    encryptionService,
    isInitialized,
    initializeEncryption,
    wallet,
    connection,
    signature,
  };
}

// Note: Privacy Cash client initialization requires a private key
// In production, this should be handled via a backend service
// The frontend only handles encryption key derivation from wallet signature
