import "./globals.css";

import localFont from "next/font/local";
import type { Metadata } from "next";
import { Toaster } from "sonner";

const polySansNeutral = localFont({
  src: "./PolySans Neutral.ttf",
  variable: "--font-poly-sans",
  display: "swap",
});

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
      <body
        className={`${polySansNeutral.variable} font-sans antialiased bg-gray-950 text-white`}
      >
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          closeButton
          richColors={false}
          toastOptions={{
            style: {
              background: "#171717",
              color: "white",
              border: "1px solid rgba(75, 85, 99, 0.3)",
              borderRadius: "0.5rem",
              padding: "0.75rem 1rem",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
            },
          }}
        />
      </body>
    </html>
  );
}
