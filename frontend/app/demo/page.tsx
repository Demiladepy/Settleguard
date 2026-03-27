"use client";

import { Navbar } from "@/components/Navbar";
import { PaymentDemo } from "@/components/PaymentDemo";
import { MonoConnect } from "@/components/MonoConnect";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-sg-bg">
      <Navbar />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <PaymentDemo />
          <div className="space-y-4">
            <MonoConnect />
          </div>
        </div>
      </main>
    </div>
  );
}
