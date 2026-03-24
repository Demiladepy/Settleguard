"use client";

import { Navbar } from "@/components/Navbar";
import { ReconciliationMatrix } from "@/components/ReconciliationMatrix";

export default function ReconciliationPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <ReconciliationMatrix />
      </main>
    </div>
  );
}
