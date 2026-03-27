"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/reconciliation", label: "Reconciliation" },
  { href: "/disputes", label: "Disputes" },
  { href: "/audit", label: "Audit" },
  { href: "/demo", label: "Pay Demo" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel("navbar-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "isw_transactions" }, () => {})
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-sg-border bg-sg-bg/90 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex h-14 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-sg-accent text-xl leading-none">&#9670;</span>
          <span className="font-mono font-bold text-sg-text text-[15px] tracking-tight">
            SettleGuard
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-sg-bg-hover text-sg-text"
                    : "text-sg-text-secondary hover:text-sg-text hover:bg-sg-bg-hover/50"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Live indicator + mobile toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                isLive ? "bg-sg-matched animate-sg-pulse" : "bg-sg-text-tertiary"
              }`}
            />
            <span
              className={`text-[11px] font-mono font-medium tracking-wider uppercase ${
                isLive ? "text-sg-matched" : "text-sg-text-tertiary"
              }`}
            >
              {isLive ? "LIVE" : "..."}
            </span>
          </div>

          <button
            className="md:hidden p-2 text-sg-text-secondary hover:text-sg-text"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <nav className="md:hidden border-t border-sg-border bg-sg-bg px-4 py-3 space-y-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm font-medium ${
                  active
                    ? "bg-sg-bg-hover text-sg-text"
                    : "text-sg-text-secondary hover:text-sg-text"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
