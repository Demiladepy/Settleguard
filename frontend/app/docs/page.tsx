"use client";

import { useState } from "react";
import { Shield, ArrowLeftRight, Book, HelpCircle, Zap, Lock, Wallet, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sections = [
    { id: "overview", label: "Overview", icon: Book },
    { id: "shield", label: "Shield Assets", icon: Shield },
    { id: "unshield", label: "Unshield Assets", icon: Shield },
    { id: "swap", label: "Private Swaps", icon: ArrowLeftRight },
    { id: "how-it-works", label: "How It Works", icon: Zap },
    { id: "faq", label: "FAQ", icon: HelpCircle },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10"></div>

      {/* Header */}
      <header className="relative z-30 w-full px-4 sm:px-6 md:px-8 py-4 sm:py-6 border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity">
            <Image
              src="/logo.jpg"
              alt="CircuitX Swap Logo"
              width={32}
              height={32}
              className="rounded sm:w-10 sm:h-10"
            />
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              circuitx_swap
            </h1>
          </Link>

          {/* Center: Navigation Box */}
          <div className="absolute left-1/2 transform -translate-x-1/2 hidden lg:flex">
            <div className="flex items-center border border-gray-700 rounded-lg bg-gray-900/50 backdrop-blur-sm overflow-hidden">
              <Link
                href="/"
                className="px-6 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors border-r border-gray-700"
              >
                Swap
              </Link>
              <Link
                href="/docs"
                className="px-6 py-2 text-sm font-medium text-white transition-colors border-r border-gray-700"
              >
                Docs
              </Link>
              <Link
                href="/tokenomics"
                className="px-6 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Tokenomics
              </Link>
            </div>
          </div>

          {/* Right: Mobile Menu Button & Navigation */}
          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-4">
              <Link
                href="/"
                className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                Back to App
              </Link>
            </div>

            {/* Mobile Back Button */}
            <Link
              href="/"
              className="lg:hidden px-3 sm:px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors text-sm sm:text-base"
            >
              <span className="hidden sm:inline">Back to App</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex max-w-7xl mx-auto w-full">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 lg:z-auto w-64 bg-gray-950 border-r border-gray-800/50 overflow-y-auto transform transition-transform duration-300 ease-in-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          {/* Navigation Menu */}
          <nav className="p-4 sm:p-6 space-y-2 pt-20 lg:pt-6">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => {
                    setActiveSection(section.id);
                    setSidebarOpen(false); // Close sidebar on mobile when section is selected
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                    activeSection === section.id
                      ? "bg-white text-black"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{section.label}</span>
                </button>
              );
            })}
            
            {/* Tokenomics Link in Sidebar */}
            <div className="pt-4 mt-4 border-t border-gray-800/50">
              <Link
                href="/tokenomics"
                onClick={() => setSidebarOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all text-gray-400 hover:text-white hover:bg-gray-800/50"
              >
                <span className="text-sm font-medium">Tokenomics</span>
              </Link>
            </div>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto w-full">
          <div className="max-w-3xl mx-auto">
            {/* Overview Section */}
            {activeSection === "overview" && (
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 sm:mb-4">Documentation</h1>
                  <p className="text-lg sm:text-xl text-gray-400 mb-6 sm:mb-8">
                    Private swaps and transfers on Solana
                  </p>
                </div>

                <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">What is CircuitX Swap?</h2>
                  <p className="text-gray-300 leading-relaxed text-sm sm:text-base">
                    CircuitX Swap is a privacy-focused platform that enables private token swaps and transfers on Solana. 
                    Using zero-knowledge proofs and an ephemeral wallet system, you can swap tokens and transfer funds 
                    without linking your wallet addresses or transaction history.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6">
                    <Lock className="h-6 w-6 sm:h-8 sm:w-8 text-white mb-2 sm:mb-3" />
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Privacy First</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">
                      Your transactions are private. No one can link your wallet addresses or see your transaction history.
                    </p>
                  </div>

                  <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6">
                    <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-white mb-2 sm:mb-3" />
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Fast & Efficient</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">
                      Powered by Jupiter for optimal routing and best prices. Swaps execute quickly on Solana.
                    </p>
                  </div>

                  <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6">
                    <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-white mb-2 sm:mb-3" />
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Secure</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">
                      Built on audited protocols with zero-knowledge proofs. Your funds are always secure.
                    </p>
                  </div>

                  <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6">
                    <Wallet className="h-6 w-6 sm:h-8 sm:w-8 text-white mb-2 sm:mb-3" />
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Easy to Use</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">
                      Simple interface for shielding, unshielding, and swapping tokens privately.
                    </p>
                  </div>
                </div>

                <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Key Features</h2>
                  <ul className="space-y-3 text-gray-300">
                    <li className="flex items-start gap-3">
                      <span className="text-white mt-1">•</span>
                      <span><strong className="text-white">Shield Assets:</strong> Deposit tokens into a private pool for anonymous transactions</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-white mt-1">•</span>
                      <span><strong className="text-white">Unshield Assets:</strong> Withdraw tokens privately to any Solana address</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-white mt-1">•</span>
                      <span><strong className="text-white">Private Swaps:</strong> Swap tokens privately using ephemeral wallets</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-white mt-1">•</span>
                      <span><strong className="text-white">Supported Tokens:</strong> SOL, USDC, USDT, ZEC, ORE, STORE</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Shield Assets Section */}
            {activeSection === "shield" && (
              <div className="space-y-4 sm:space-y-6">
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 sm:mb-4">Shield Assets</h1>
                
                <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">What is Shielding?</h2>
                  <p className="text-gray-300 leading-relaxed">
                    Shielding (also called depositing) allows you to move tokens from your public wallet into a private pool. 
                    Once shielded, your tokens are stored in an encrypted state and cannot be traced back to your wallet address.
                  </p>
                </div>

                <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">How to Shield Assets</h2>
                  <ol className="space-y-2 sm:space-y-3 text-gray-300 list-decimal list-inside text-sm sm:text-base">
                    <li>Connect your Solana wallet</li>
                    <li>Select the token you want to shield (SOL, USDC, USDT, etc.)</li>
                    <li>Enter the amount you want to shield</li>
                    <li>Click &quot;Shield&quot; and approve the transaction in your wallet</li>
                    <li>Your tokens are now in the private pool</li>
                  </ol>
                </div>

                <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Fees</h2>
                  <p className="text-gray-300 text-sm sm:text-base">
                    Network fees apply (~0.002 SOL) for the transaction. This is paid to Solana validators, not to CircuitX Swap.
                  </p>
                </div>
              </div>
            )}

            {/* Unshield Assets Section */}
            {activeSection === "unshield" && (
              <div className="space-y-4 sm:space-y-6">
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 sm:mb-4">Unshield Assets</h1>
                
                <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">What is Unshielding?</h2>
                  <p className="text-gray-300 leading-relaxed">
                    Unshielding (also called withdrawing) allows you to move tokens from the private pool to any Solana address. 
                    The withdrawal is private - no one can link it to your original deposit or see your transaction history.
                  </p>
                </div>

                <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">How to Unshield Assets</h2>
                  <ol className="space-y-2 sm:space-y-3 text-gray-300 list-decimal list-inside text-sm sm:text-base">
                    <li>Connect your Solana wallet</li>
                    <li>Switch to &quot;Unshield&quot; mode</li>
                    <li>Select the token you want to unshield</li>
                    <li>Enter the recipient address (can be any Solana address)</li>
                    <li>Enter the amount to unshield</li>
                    <li>Click &quot;Unshield&quot; and approve the transaction</li>
                    <li>Tokens are sent privately to the recipient address</li>
                  </ol>
                </div>

                <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Fees</h2>
                  <p className="text-gray-300 text-sm sm:text-base">
                    Unshielding fees: Base 0.006 SOL + 0.35% protocol fee. These fees go to the privacy protocol, not CircuitX Swap.
                  </p>
                </div>
              </div>
            )}

            {/* Private Swaps Section */}
            {activeSection === "swap" && (
              <div className="space-y-4 sm:space-y-6">
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 sm:mb-4">Private Swaps</h1>
                
                <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">What are Private Swaps?</h2>
                  <p className="text-gray-300 leading-relaxed text-sm sm:text-base">
                    Private swaps allow you to exchange tokens without revealing your wallet addresses or transaction history. 
                    The swap process uses an ephemeral (temporary) wallet to break the link between your input and output tokens.
                  </p>
                </div>

                <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">How Private Swaps Work</h2>
                  <ol className="space-y-3 sm:space-y-4 text-gray-300 text-sm sm:text-base">
                    <li className="flex items-start gap-2 sm:gap-3">
                      <span className="bg-white text-black rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0">1</span>
                      <div>
                        <strong className="text-white">Withdraw from Private Pool:</strong> If you have tokens in the private pool, 
                        they are withdrawn to an ephemeral wallet. If not, tokens are first shielded.
                      </div>
                    </li>
                    <li className="flex items-start gap-2 sm:gap-3">
                      <span className="bg-white text-black rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0">2</span>
                      <div>
                        <strong className="text-white">Swap via Ephemeral Wallet:</strong> The swap is executed from the ephemeral wallet 
                        using Jupiter for optimal routing and best prices.
                      </div>
                    </li>
                    <li className="flex items-start gap-2 sm:gap-3">
                      <span className="bg-white text-black rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0">3</span>
                      <div>
                        <strong className="text-white">Deposit Back to Private Pool:</strong> The output tokens are automatically 
                        deposited back into the private pool from the ephemeral wallet.
                      </div>
                    </li>
                    <li className="flex items-start gap-2 sm:gap-3">
                      <span className="bg-white text-black rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0">4</span>
                      <div>
                        <strong className="text-white">Return Remaining SOL:</strong> Any remaining SOL in the ephemeral wallet 
                        is automatically returned to your main wallet.
                      </div>
                    </li>
                  </ol>
                </div>

                <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Fees</h2>
                  <ul className="space-y-2 text-gray-300 text-sm sm:text-base">
                    <li>• <strong className="text-white">Platform fee:</strong> 0.25% of swap volume</li>
                    <li>• <strong className="text-white">Slippage tolerance:</strong> 0.5%</li>
                    <li>• <strong className="text-white">Network fees:</strong> ~0.002 SOL per transaction</li>
                  </ul>
                </div>
              </div>
            )}

            {/* How It Works Section */}
            {activeSection === "how-it-works" && (
              <div className="space-y-4 sm:space-y-6">
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 sm:mb-4">How It Works</h1>
                
                {/* Privacy Flow Diagram */}
                <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Privacy Flow</h2>
                  <div className="w-full overflow-hidden rounded-lg">
                    <Image
                      src="/privacy_flow_diagram.png"
                      alt="Privacy Flow Diagram"
                      width={1200}
                      height={800}
                      className="w-full h-auto"
                      priority
                    />
                  </div>
                  <p className="text-gray-400 text-sm sm:text-base mt-4">
                    This diagram illustrates how private swaps maintain privacy by using ephemeral wallets and zero-knowledge proofs.
                  </p>
                </div>
                
                <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Privacy Technology</h2>
                  <p className="text-gray-300 leading-relaxed mb-4">
                    CircuitX Swap uses advanced privacy technologies to ensure your transactions remain private:
                  </p>
                  <ul className="space-y-3 text-gray-300">
                    <li className="flex items-start gap-3">
                      <span className="text-white mt-1">•</span>
                      <div>
                        <strong className="text-white">Zero-Knowledge Proofs:</strong> Mathematical proofs that verify transactions 
                        without revealing any details about the amounts or addresses involved.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-white mt-1">•</span>
                      <div>
                        <strong className="text-white">Ephemeral Wallets:</strong> Temporary wallets derived deterministically from your signature. 
                        These wallets break the link between your input and output tokens.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-white mt-1">•</span>
                      <div>
                        <strong className="text-white">Encrypted UTXOs:</strong> Your balance is stored as encrypted unspent transaction outputs 
                        that cannot be traced back to your wallet.
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">The Swap Flow</h2>
                  <div className="space-y-3 sm:space-y-4 text-gray-300 text-sm sm:text-base">
                    <div className="border-l-2 border-white/20 pl-3 sm:pl-4">
                      <p className="font-semibold text-white mb-1">1. Withdraw Privately</p>
                      <p className="text-xs sm:text-sm">Tokens are withdrawn from the private pool to an ephemeral wallet. This breaks the link to your original deposit.</p>
                    </div>
                    <div className="border-l-2 border-white/20 pl-3 sm:pl-4">
                      <p className="font-semibold text-white mb-1">2. Swap</p>
                      <p className="text-xs sm:text-sm">The swap happens from the ephemeral wallet using Jupiter. No one can see it&apos;s connected to your main wallet.</p>
                    </div>
                    <div className="border-l-2 border-white/20 pl-3 sm:pl-4">
                      <p className="font-semibold text-white mb-1">3. Reshield</p>
                      <p className="text-xs sm:text-sm">Output tokens are deposited back into the private pool, maintaining privacy.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FAQ Section */}
            {activeSection === "faq" && (
              <div className="space-y-4 sm:space-y-6">
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 sm:mb-4">Frequently Asked Questions</h1>
                
                <div className="space-y-3 sm:space-y-4">
                  <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2">What tokens are supported?</h3>
                    <p className="text-gray-300">
                      Currently supported tokens: SOL, USDC, USDT, ZEC, ORE, and STORE. More tokens may be added in the future.
                    </p>
                  </div>

                  <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2">How private are my transactions?</h3>
                      <p className="text-gray-300 text-sm sm:text-base">
                      Your transactions are completely private. No one can link your wallet addresses, see your transaction history, 
                      or determine the amounts you&apos;re swapping or transferring.
                      </p>
                  </div>

                  <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2">What is an ephemeral wallet?</h3>
                      <p className="text-gray-300 text-sm sm:text-base">
                      An ephemeral wallet is a temporary wallet derived deterministically from your signature. It&apos;s used during swaps 
                      to break the link between your input and output tokens. You control it through your main wallet signature, 
                      but it appears as a separate, unlinked address on-chain.
                      </p>
                  </div>

                  <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2">What happens if a swap fails?</h3>
                      <p className="text-gray-300 text-sm sm:text-base">
                      If a swap fails, any tokens or SOL remaining in the ephemeral wallet can be recovered using the 
                      &quot;Recover Stuck Funds&quot; feature. This ensures you never lose funds due to failed transactions.
                      </p>
                  </div>

                  <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6">
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-2">How much does it cost?</h3>
                    <p className="text-gray-300 text-sm sm:text-base">
                      <strong className="text-white">Shielding:</strong> Network fees only (~0.002 SOL)<br />
                      <strong className="text-white">Unshielding:</strong> Base 0.006 SOL + 0.35% protocol fee<br />
                      <strong className="text-white">Swaps:</strong> 0.25% platform fee + network fees
                    </p>
                  </div>

                  <div className="bg-white/5 border border-gray-800 rounded-lg p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Is my wallet safe?</h3>
                    <p className="text-gray-300 text-sm sm:text-base">
                      Yes. CircuitX Swap uses audited protocols and zero-knowledge proofs. Your private keys never leave your wallet, 
                      and you maintain full control over your funds at all times.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="relative z-10 mt-auto py-8 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">Powered by Jupiter & Privacy Cash</p>
            <div className="flex items-center gap-6">
              <a
                href="https://x.com/i/communities/2015047501058097323"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span>Join X Community</span>
              </a>
              <a
                href="https://x.com/circuitx_app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span>CircuitX X</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
