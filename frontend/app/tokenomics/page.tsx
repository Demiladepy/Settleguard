"use client";

import { useState } from "react";
import { Menu, X, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { WalletButton } from "@/components/counter/WalletButton";

export default function TokenomicsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10"></div>

      {/* Header */}
      <header className="relative z-20 w-full px-4 sm:px-6 md:px-8 py-4 sm:py-6 border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
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
                className="px-6 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors border-r border-gray-700"
              >
                Docs
              </Link>
              <Link
                href="/tokenomics"
                className="px-6 py-2 text-sm font-medium text-white transition-colors"
              >
                Tokenomics
              </Link>
            </div>
          </div>

          {/* Right: Mobile Menu & Wallet Connect */}
          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            {/* Mobile Hamburger Menu */}
            <div className="lg:hidden relative">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              
              {/* Mobile Menu Dropdown */}
              {mobileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 bg-black/50 z-30"
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-40 overflow-hidden">
                    <Link
                      href="/"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-white hover:text-black transition-colors"
                    >
                      <span className="text-sm font-medium">Swap</span>
                    </Link>
                    <Link
                      href="/docs"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-white hover:text-black transition-colors border-t border-gray-800"
                    >
                      <span className="text-sm font-medium">Docs</span>
                    </Link>
                    <Link
                      href="/tokenomics"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-white hover:text-black transition-colors border-t border-gray-800"
                    >
                      <span className="text-sm font-medium">Tokenomics</span>
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* Wallet Button - Always Visible */}
            <div className="scale-90 sm:scale-100">
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col px-4 sm:px-6 md:px-8 py-8 sm:py-12">
        <div className="w-full max-w-6xl mx-auto space-y-16 sm:space-y-20">
          
          {/* Revenue Flow Simulation */}
          <div className="space-y-6">
            <h2 className="text-2xl sm:text-3xl font-semibold text-white uppercase tracking-wide">
              REVENUE FLOW SIMULATION
            </h2>
            <div className="space-y-6">
              <div>
                <p className="text-xl sm:text-2xl font-semibold text-white uppercase mb-2">
                  REVENUE TO
                </p>
                <p className="text-xl sm:text-2xl font-semibold text-white uppercase">
                  BUYBACK FLOW
                </p>
              </div>

              {/* Animated Flow Diagram */}
              <div className="relative py-8 sm:py-12 overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
                  {/* Swap Revenue Box */}
                  <div className="relative group">
                    <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border-2 border-green-500/50 rounded-lg px-6 py-4 backdrop-blur-sm">
                      <p className="text-sm text-gray-300 mb-1">Swap Revenue</p>
                      <p className="text-xl sm:text-2xl font-semibold text-white">0.25%</p>
                      <p className="text-xs text-gray-400 mt-1">Platform Fee</p>
                    </div>
                    {/* Pulse animation */}
                    <div className="absolute inset-0 bg-green-500/20 rounded-lg animate-pulse"></div>
                  </div>

                  {/* Animated Arrow */}
                  <div className="relative flex-shrink-0">
                    <svg className="w-12 h-12 sm:w-16 sm:h-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    {/* Flowing particles animation */}
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="absolute top-1/2 left-0 w-2 h-2 bg-green-400 rounded-full animate-flow-right"></div>
                      <div className="absolute top-1/2 left-0 w-1.5 h-1.5 bg-green-300 rounded-full animate-flow-right-delayed"></div>
                    </div>
                  </div>

                  {/* Buyback & Burn Box */}
                  <div className="relative group">
                    <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border-2 border-orange-500/50 rounded-lg px-6 py-4 backdrop-blur-sm">
                      <p className="text-sm text-gray-300 mb-1">Buyback & Burn</p>
                      <p className="text-xl sm:text-2xl font-semibold text-white">$CUIT</p>
                      <p className="text-xs text-gray-400 mt-1">Token Reduction</p>
                    </div>
                    {/* Pulse animation */}
                    <div className="absolute inset-0 bg-orange-500/20 rounded-lg animate-pulse-delayed"></div>
                  </div>
                </div>

                {/* Flow line animation */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-green-500 via-green-400 to-orange-500 opacity-30 hidden sm:block">
                  <div className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer"></div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-4 pt-4 border-t border-gray-700/50">
                <div className="bg-gray-900/50 rounded-lg p-5 border border-gray-700/50">
                  <p className="text-base sm:text-lg text-gray-200 leading-relaxed mb-3">
                    The CircuitX accepts SOL to buy $CUIT.
                  </p>
                  <p className="text-base sm:text-lg text-gray-200 leading-relaxed mb-3">
                    <span className="font-semibold text-green-400">0.25% platform fees</span> collected from each swap transaction are automatically used as buybacks and burn mechanism.
                  </p>
                  <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                    This revenue accumulates and is used to purchase $CUIT tokens from the market, which are then permanently burned, reducing the total supply and creating deflationary pressure.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Token Distribution Overview */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-white uppercase tracking-wide mb-3">
                TOKEN DISTRIBUTION OVERVIEW
              </h2>
              <p className="text-base sm:text-lg text-gray-300 italic">
                Fair launch tokenomics designed to reward builders and grow the ecosystem.
              </p>
            </div>
            
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-10 lg:gap-12">
              {/* Pie Chart */}
              <div className="flex-shrink-0">
                <div className="relative w-64 h-64 sm:w-80 sm:h-80">
                  <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                    {/* Liquid Supply - 99.4% */}
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke="#4ade80"
                      strokeWidth="40"
                      strokeDasharray={`${99.4 * 2 * Math.PI * 80 / 100} ${2 * Math.PI * 80}`}
                      className="transition-all duration-500"
                    />
                    {/* Growth & Development - 0.6% */}
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="40"
                      strokeDasharray={`${0.6 * 2 * Math.PI * 80 / 100} ${2 * Math.PI * 80}`}
                      strokeDashoffset={`-${99.4 * 2 * Math.PI * 80 / 100}`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-4xl sm:text-5xl font-bold text-white">1B</div>
                    <div className="text-sm sm:text-base text-gray-400 mt-1">Total Supply</div>
                  </div>
                </div>
              </div>

              {/* Distribution Details */}
              <div className="flex-1 w-full space-y-6">
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="w-4 h-4 rounded-full bg-[#4ade80]"></div>
                    <div>
                      <p className="text-lg sm:text-xl font-bold text-white">Liquid Supply</p>
                      <p className="text-base sm:text-lg text-gray-300">1B</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-4 h-4 rounded-full bg-[#64748b]"></div>
                    <div>
                      <p className="text-lg sm:text-xl font-bold text-white">Growth & Development</p>
                      <p className="text-base sm:text-lg text-gray-300">0.6%</p>
                    </div>
                  </div>
                </div>

                {/* Contract Address */}
                <div className="pt-5 border-t border-gray-700">
                  <p className="text-sm sm:text-base text-gray-400 mb-2">Contract Address</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value="2FcRaEB4NCoUvR5NNLCrPM9iTT3pGaKTh823zjFjBAGS"
                      className="flex-1 bg-gray-900 border border-gray-700 rounded px-4 py-2 font-mono text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-text"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText("2FcRaEB4NCoUvR5NNLCrPM9iTT3pGaKTh823zjFjBAGS");
                      }}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                      aria-label="Copy address"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Available On */}
          <div className="space-y-6">
            <h2 className="text-2xl sm:text-3xl font-semibold text-white uppercase tracking-wide">
              AVAILABLE ON
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Bags.Fm */}
              <a
                href="https://bags.fm/2FcRaEB4NCoUvR5NNLCrPM9iTT3pGaKTh823zjFjBAGS"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 p-6 bg-gray-900/50 border border-gray-700 rounded-lg hover:border-green-500 transition-all hover:bg-gray-800/50"
              >
                <div className="flex-shrink-0 w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                  <Image
                    src="/bagsfm.png"
                    alt="Bags.Fm"
                    width={48}
                    height={48}
                    className="object-contain"
                    onError={(e) => {
                      // Fallback if image doesn't exist
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.innerHTML = '<span class="text-gray-600 font-bold">Bags</span>';
                    }}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-lg sm:text-xl font-semibold text-white">Bags.Fm</p>
                    <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors" />
                  </div>
                </div>
              </a>

              {/* Jupiter */}
              <a
                href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=2FcRaEB4NCoUvR5NNLCrPM9iTT3pGaKTh823zjFjBAGS"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 p-6 bg-gray-900/50 border border-gray-700 rounded-lg hover:border-green-500 transition-all hover:bg-gray-800/50"
              >
                <div className="flex-shrink-0 w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                  <Image
                    src="/jupiter.png"
                    alt="Jupiter"
                    width={48}
                    height={48}
                    className="object-contain"
                    onError={(e) => {
                      // Fallback if image doesn't exist
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.innerHTML = '<span class="text-gray-600 font-semibold">JUP</span>';
                    }}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-lg sm:text-xl font-semibold text-white">Jupiter</p>
                    <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors" />
                  </div>
                </div>
              </a>
            </div>
          </div>

        </div>
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
