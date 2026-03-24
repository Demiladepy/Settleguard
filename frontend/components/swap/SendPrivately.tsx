"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Loader2, ArrowDown, ArrowUp } from "lucide-react";
import { usePrivacyCash } from "@/lib/privacy-cash";
import {
  PrivacyCashToken,
  PRIVACY_CASH_TOKENS,
  PRIVACY_CASH_TOKEN_LIST,
} from "@/lib/privacy-cash-tokens";
import {
  depositTokenToPrivacyCash,
  withdrawTokenFromPrivacyCash,
  getPrivateTokenBalanceDirect,
} from "@/lib/privacy-cash-helpers";
import { awardPointsForSwap } from "@/lib/points-api";

export function SendPrivately() {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { initializeEncryption, isInitialized, encryptionService } = usePrivacyCash();
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [selectedToken, setSelectedToken] = useState<PrivacyCashToken>("SOL");
  const [privateBalance, setPrivateBalance] = useState<number | null>(null);
  const [shieldStatus, setShieldStatus] = useState<string | null>(null);

  // Initialize Privacy Cash encryption on mount
  useEffect(() => {
    if (connected && !isInitialized && !isInitializing) {
      setIsInitializing(true);
      initializeEncryption()
        .then(() => {
          toast.success("Privacy Cash initialized");
        })
        .catch((error) => {
          console.error("Failed to initialize Privacy Cash:", error);
          toast.error("Failed to initialize Privacy Cash", {
            description: error.message,
          });
        })
        .finally(() => {
          setIsInitializing(false);
        });
    }
  }, [connected, isInitialized, initializeEncryption, isInitializing]);

  // Check private balance when token changes
  useEffect(() => {
    const checkPrivateBalance = async () => {
      if (
        encryptionService &&
        publicKey &&
        selectedToken &&
        connected &&
        isInitialized
      ) {
        try {
          const balance = await getPrivateTokenBalanceDirect(
            connection,
            publicKey,
            encryptionService,
            selectedToken
          );
          setPrivateBalance(balance);
        } catch (error) {
          console.error("Failed to check private balance:", error);
          setPrivateBalance(null);
        }
      } else {
        setPrivateBalance(null);
      }
    };

    checkPrivateBalance();
  }, [encryptionService, publicKey, selectedToken, connected, isInitialized, connection]);

  const handleDeposit = async () => {
    if (!connected || !publicKey || !signTransaction || !encryptionService) {
      toast.error("Please connect wallet and sign in to Privacy Cash");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    setShieldStatus("Shielding assets into Privacy Cash...");

    try {
      toast.loading("Shielding assets...", { id: "deposit" });
      setShieldStatus("Shielding assets into Privacy Cash...");
      const result = await depositTokenToPrivacyCash(
        connection,
        publicKey,
        encryptionService,
        selectedToken,
        parseFloat(amount),
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

      toast.success("Deposit successful!", {
        id: "deposit",
        description: `Transaction: ${result.tx.slice(0, 8)}...`,
        action: {
          label: "View",
          onClick: () => window.open(`https://solscan.io/tx/${result.tx}`, "_blank"),
        },
      });
      setShieldStatus("Shield completed successfully");
      if (publicKey) awardPointsForSwap(publicKey.toBase58(), result.tx);

      // Reset form and refresh balance
      setAmount("");
      if (encryptionService && publicKey) {
        const balance = await getPrivateTokenBalanceDirect(
          connection,
          publicKey,
          encryptionService,
          selectedToken
        );
        setPrivateBalance(balance);
      }
    } catch (error: unknown) {
      console.error("Deposit error:", error);
      
      // Provide more helpful error messages
      const message = error instanceof Error ? error.message : String(error);
      let errorMessage = message || "Unknown error occurred";
      
      if (errorMessage.includes("response not ok")) {
        errorMessage = "Relayer API error. Common causes:\n• Insufficient SOL for fees (need ~0.002 SOL)\n• Relayer service temporarily unavailable\n• Transaction validation failed\n\nCheck browser console (F12) for detailed error message.";
      } else if (errorMessage.includes("Insufficient balance")) {
        errorMessage = "Insufficient balance. Please ensure you have enough tokens and SOL for fees (~0.002 SOL).";
      } else if (errorMessage.includes("Don't deposit more than")) {
        errorMessage = message;
      }
      
      toast.error("Deposit failed", {
        id: "deposit",
        description: errorMessage,
        duration: 8000, // Show longer for detailed errors
      });
    } finally {
      setIsLoading(false);
      // Keep last status so the user can see what happened
    }
  };

  const handleWithdraw = async () => {
    if (!connected || !publicKey || !encryptionService) {
      toast.error("Please connect wallet and sign in to Privacy Cash");
      return;
    }

    if (!recipientAddress) {
      toast.error("Please enter recipient address");
      return;
    }

    try {
      new PublicKey(recipientAddress);
    } catch {
      toast.error("Invalid recipient address");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    setShieldStatus("Unshielding assets to recipient...");

    try {
      toast.loading("Unshielding assets...", { id: "withdraw" });
      setShieldStatus("Unshielding assets to recipient wallet...");
      const result = await withdrawTokenFromPrivacyCash(
        connection,
        publicKey,
        encryptionService,
        selectedToken,
        parseFloat(amount),
        new PublicKey(recipientAddress)
      );

      toast.success("Withdrawal successful!", {
        id: "withdraw",
        description: `Transaction: ${result.tx.slice(0, 8)}... | Recipient: ${result.recipient.slice(0, 8)}...`,
        action: {
          label: "View",
          onClick: () => window.open(`https://solscan.io/tx/${result.tx}`, "_blank"),
        },
      });
      setShieldStatus("Unshield completed successfully");

      // Reset form and refresh balance
      setRecipientAddress("");
      setAmount("");
      if (encryptionService && publicKey) {
        const balance = await getPrivateTokenBalanceDirect(
          connection,
          publicKey,
          encryptionService,
          selectedToken
        );
        setPrivateBalance(balance);
      }
    } catch (error: unknown) {
      console.error("Withdraw error:", error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Withdrawal failed", {
        id: "withdraw",
        description: message || "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-5xl border border-black bg-white shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-black">
          <Shield className="h-5 w-5" />
          Unshield assets
        </CardTitle>
        <CardDescription className="text-gray-600">
          Shield assets for private transactions or unshield to any address
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {!connected && (
          <div className="text-center py-8 text-gray-600">
            Please connect your wallet to continue
          </div>
        )}

        {connected && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Column: Mode Toggle & Token Selection */}
            <div className="space-y-4">
              {/* Mode Toggle */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-black">Action</label>
                <div className="flex gap-2">
                  <Button
                    variant={mode === "deposit" ? "default" : "outline"}
                    onClick={() => setMode("deposit")}
                    className={`flex-1 ${
                      mode === "deposit"
                        ? "bg-black text-white border-black hover:bg-gray-900"
                        : "bg-white text-black border-black hover:bg-gray-100"
                    }`}
                  >
                    <ArrowDown className="mr-2 h-4 w-4" />
                    Deposit
                  </Button>
                  <Button
                    variant={mode === "withdraw" ? "default" : "outline"}
                    onClick={() => setMode("withdraw")}
                    className={`flex-1 ${
                      mode === "withdraw"
                        ? "bg-black text-white border-black hover:bg-gray-900"
                        : "bg-white text-black border-black hover:bg-gray-100"
                    }`}
                  >
                    <ArrowUp className="mr-2 h-4 w-4" />
                    Withdraw
                  </Button>
                </div>
              </div>

              {/* Token Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-black">Token</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRIVACY_CASH_TOKEN_LIST.map((token) => (
                    <Button
                      key={token.symbol}
                      variant={selectedToken === token.symbol ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedToken(token.symbol)}
                      className={`w-full ${
                        selectedToken === token.symbol
                          ? "bg-black text-white border-black hover:bg-gray-900"
                          : "bg-white text-black border-black hover:bg-gray-100"
                      }`}
                    >
                      {token.symbol}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Private Balance Display */}
              {privateBalance !== null && privateBalance > 0 && (
                <div className="text-xs text-gray-600 p-2 bg-gray-100 rounded">
                  Private {selectedToken} balance:{" "}
                  {(privateBalance / Math.pow(10, PRIVACY_CASH_TOKENS[selectedToken].decimals)).toFixed(6)}
                </div>
              )}

              {!isInitialized && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                  {isInitializing ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Initializing Privacy Cash...
                    </div>
                  ) : (
                    "Please sign the message to enable private transactions"
                  )}
                </div>
              )}
            </div>

            {/* Middle Column: Inputs */}
            <div className="lg:col-span-2 space-y-4">
              {/* Recipient Address (only for withdraw) */}
              {mode === "withdraw" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-black">
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="Enter Solana address"
                    className="w-full px-3 py-2 bg-white border border-black rounded-md text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              )}

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-black">Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.000001"
                  min="0"
                  className="w-full px-3 py-2 bg-white border border-black rounded-md text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Action Button */}
              <Button
                onClick={mode === "deposit" ? handleDeposit : handleWithdraw}
                disabled={isLoading || !amount || (mode === "withdraw" && !recipientAddress)}
                className="w-full bg-black text-white hover:bg-gray-900 border border-black"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : mode === "deposit" ? (
                  <>
                    <ArrowDown className="mr-2 h-4 w-4" />
                    Shield
                  </>
                ) : (
                  <>
                    <ArrowUp className="mr-2 h-4 w-4" />
                    Unshield
                  </>
                )}
              </Button>

              {/* Inline Shield / Unshield Status */}
              {shieldStatus && (
                <div className="mt-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                  <span className="font-semibold text-black">Current step:</span>{" "}
                  <span>{shieldStatus}</span>
                </div>
              )}
            </div>

            {/* Right Column: Info */}
            <div className="space-y-4">
              <div className="text-xs text-gray-600 space-y-1">
                {mode === "deposit" ? (
                  <>
                    <p>• Deposit assets to Privacy Cash for private transactions</p>
                    <p>• Network fees apply (~0.002 SOL)</p>
                  </>
                ) : (
                  <>
                    <p>• Withdraw assets privately to any address</p>
                    <p>• Fees: Base 0.006 SOL + 0.35% protocol fee</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
