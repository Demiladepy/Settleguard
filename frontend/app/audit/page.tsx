"use client";

import { Navbar } from "@/components/Navbar";
import { AuditChainHealth } from "@/components/AuditChainHealth";

export default function AuditPage() {
  return (
    <div className="min-h-screen bg-sg-bg">
      <Navbar />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <AuditChainHealth />
      </main>
    </div>
  );
}
