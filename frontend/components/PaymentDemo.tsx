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
        // Send to webhook for server-side verification
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
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gray-500" /></div>;
  }

  return (
    <div className="space-y-8">
      <Script src="https://newwebpay.qa.interswitchng.com/inline-checkout.js" strategy="lazyOnload" />

      <div>
        <h1 className="text-2xl font-bold">Payment Demo</h1>
        <p className="text-gray-400 text-sm mt-1">
          Pay an invoice using Interswitch test cards. Payment triggers real-time reconciliation.
        </p>
      </div>

      {/* Test card info */}
      <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-blue-400 mb-2">Test Card for Demo</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><span className="text-gray-400 text-xs">Card</span><p className="text-white font-mono text-xs">5060990580000217499</p></div>
          <div><span className="text-gray-400 text-xs">Expiry</span><p className="text-white font-mono text-xs">03/50</p></div>
          <div><span className="text-gray-400 text-xs">CVV</span><p className="text-white font-mono text-xs">111</p></div>
          <div><span className="text-gray-400 text-xs">PIN</span><p className="text-white font-mono text-xs">1111</p></div>
        </div>
      </div>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-8 text-center">
          <CreditCard className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No invoices yet. Seed demo data from the dashboard first.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {invoices.map((inv) => (
            <div key={inv.id} className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-white">{inv.invoice_number}</p>
                  <p className="text-gray-400 text-sm">{inv.customer_name}</p>
                  <p className="text-gray-500 text-xs">{inv.customer_email}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${inv.status === "paid" ? "bg-emerald-900/50 text-emerald-400" : inv.status === "overdue" ? "bg-red-900/50 text-red-400" : "bg-gray-700 text-gray-300"}`}>
                  {inv.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold text-white">{koboToNaira(inv.amount_kobo)}</p>
                {inv.status !== "paid" ? (
                  <button
                    onClick={() => handlePay(inv)}
                    disabled={paying === inv.id}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {paying === inv.id ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" />Processing...</>
                    ) : (
                      <><ExternalLink className="w-4 h-4" />Pay with ISW</>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Paid
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
