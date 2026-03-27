import "./globals.css";

import type { Metadata } from "next";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "SettleGuard — Multi-Source AI Reconciliation Engine",
  description:
    "Three-way payment reconciliation across Interswitch, bank accounts, and ERP systems. Powered by AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-[#0A0E17] text-[#F1F5F9]">
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          closeButton
          richColors={false}
          toastOptions={{
            style: {
              background: "#111827",
              color: "#F1F5F9",
              border: "1px solid #1E293B",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              fontFamily: "'DM Sans', sans-serif",
            },
          }}
        />
      </body>
    </html>
  );
}
