"use client";

import { Navbar } from "@/components/Navbar";
import { PaymentDemo } from "@/components/PaymentDemo";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-sg-bg">
      <Navbar />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <PaymentDemo />
      </main>
    </div>
  );
}
