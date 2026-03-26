"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BarChart3, AlertTriangle, Link2, CreditCard, Menu, X, Shield } from "lucide-react";
import { useState } from "react";

const links = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/reconciliation", label: "Reconciliation", icon: Link2 },
  { href: "/disputes", label: "Disputes", icon: AlertTriangle },
  { href: "/audit", label: "Audit Chain", icon: Shield },
  { href: "/demo", label: "Pay Demo", icon: CreditCard },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg overflow-hidden ring-1 ring-emerald-500/30">
            <Image src="/logo.jpg" alt="SettleGuard" width={36} height={36} className="object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight leading-tight">SettleGuard</span>
            <span className="text-[10px] text-emerald-400/70 leading-tight tracking-wider uppercase">Reconciliation Engine</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}
              >
                <l.icon className="w-3.5 h-3.5" />
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-gray-400 hover:text-white"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {open && (
        <nav className="md:hidden border-t border-gray-800/60 bg-gray-950 px-4 py-3 space-y-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                  active
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <l.icon className="w-4 h-4" />
                {l.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
