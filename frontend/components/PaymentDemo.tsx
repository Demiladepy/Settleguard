"use client";

import { useEffect, useState, useCallback } from "react";
import { CreditCard, RefreshCw, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import Script from "next/script";

interface Invoice {
  id: string;
  invoice_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  amount_kobo: number;
  status: string;
}

function koboToNaira(k: number) {
  return `₦${(k / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

declare global {
  interface Window {
    webpayCheckout?: (config: Record<string, unknown>) => void;
  }
}

export function PaymentDemo() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch("/api/invoices");
      const data = await res.json();
      setInvoices(data.invoices || []);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handlePay = (invoice: Invoice) => {
    if (!window.webpayCheckout) {
      toast.error("Interswitch checkout script not loaded yet");
      return;
    }

    setPaying(invoice.id);
    const txnRef = `SG-${invoice.invoice_number}-${Date.now()}`;

    window.webpayCheckout({
      merchant_code: "MX6072",
      pay_item_id: "9405967",
      txn_ref: txnRef,
      amount: invoice.amount_kobo,
      currency: 566,
      cust_email: invoice.customer_email || "demo@settleguard.ng",
      cust_name: invoice.customer_name || "Demo Customer",
      site_redirect_url: `${window.location.origin}/demo`,
      mode: "TEST",
      onComplete: async (response: Record<string, unknown>) => {
        console.log("ISW response:", response);
        try {
          const res = await fetch("/api/webhooks/interswitch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              txn_ref: txnRef,
              invoice_id: invoice.id,
              amount_kobo: invoice.amount_kobo,
            }),
          });
          const data = await res.json();
          if (data.success) {
            toast.success(`Payment verified! Match: ${data.reconciliation?.match_status || "processing"}`);
          } else {
            toast.error(`Payment verification: ${data.transaction?.response_desc || "failed"}`);
          }
          fetchInvoices();
        } catch {
          toast.error("Failed to verify payment");
        }
        setPaying(null);
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-5 h-5 animate-sg-spin text-sg-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Script src="https://newwebpay.qa.interswitchng.com/inline-checkout.js" strategy="lazyOnload" />

      {/* Header */}
      <div>
        <h1 className="text-xl font-mono font-bold text-sg-text">Payment Demo</h1>
        <p className="text-sg-text-tertiary text-[13px] mt-0.5">
          Pay an invoice using Interswitch test cards &mdash; triggers real-time reconciliation
        </p>
      </div>

      {/* Test card info */}
      <div className="bg-sg-info/5 border border-sg-info/20 rounded-lg p-4">
        <h2 className="text-[11px] font-mono font-semibold text-sg-info uppercase tracking-wider mb-3">
          Test Card for Demo
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "CARD", value: "5060990580000217499" },
            { label: "EXPIRY", value: "03/50" },
            { label: "CVV", value: "111" },
            { label: "PIN", value: "1111" },
          ].map((item) => (
            <div key={item.label}>
              <span className="text-sg-text-tertiary text-[10px] font-mono uppercase tracking-wider">{item.label}</span>
              <p className="text-sg-text font-mono text-[13px] font-medium mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="bg-sg-bg-card border border-sg-border rounded-lg p-8 text-center">
          <CreditCard className="w-6 h-6 text-sg-text-tertiary mx-auto mb-3" />
          <p className="text-sg-text-tertiary text-sm">
            No invoices yet. Seed demo data from the dashboard first.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {invoices.map((inv) => (
            <div key={inv.id} className="bg-sg-bg-card border border-sg-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono font-semibold text-sg-text text-[13px]">{inv.invoice_number}</p>
                  <p className="text-sg-text-secondary text-[13px]">{inv.customer_name}</p>
                  <p className="text-sg-text-tertiary text-[11px] font-mono">{inv.customer_email}</p>
                </div>
                <span className={`text-[11px] font-mono font-medium px-1.5 py-0.5 rounded-sm ${
                  inv.status === "paid"
                    ? "text-sg-matched bg-sg-matched/10"
                    : inv.status === "overdue"
                    ? "text-sg-mismatch bg-sg-mismatch/10"
                    : "text-sg-text-secondary bg-sg-bg-hover"
                }`}>
                  {inv.status.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xl font-mono font-bold text-sg-text tabular-nums">
                  {koboToNaira(inv.amount_kobo)}
                </p>
                {inv.status !== "paid" ? (
                  <button
                    onClick={() => handlePay(inv)}
                    disabled={paying === inv.id}
                    className="px-3 py-1.5 bg-sg-accent/10 border border-sg-accent/30 hover:bg-sg-accent/20 rounded-md text-[13px] font-medium text-sg-accent transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {paying === inv.id ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-sg-spin" />Processing...</>
                    ) : (
                      <><ExternalLink className="w-3.5 h-3.5" />Pay with ISW</>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-sg-matched text-[13px] font-mono">
                    <CheckCircle2 className="w-4 h-4" />
                    PAID
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
