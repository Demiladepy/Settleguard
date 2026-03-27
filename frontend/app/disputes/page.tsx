"use client";

import { Navbar } from "@/components/Navbar";
import { DisputeInvestigation } from "@/components/DisputeInvestigation";

export default function DisputesPage() {
  return (
    <div className="min-h-screen bg-sg-bg">
      <Navbar />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <DisputeInvestigation />
      </main>
    </div>
  );
}
