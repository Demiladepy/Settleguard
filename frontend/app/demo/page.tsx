"use client";

import { Navbar } from "@/components/Navbar";
import { PaymentDemo } from "@/components/PaymentDemo";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <PaymentDemo />
      </main>
    </div>
  );
}
