import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/health — System health check.
 * Returns status of all integrations for monitoring and demo readiness.
 */
export async function GET() {
  const checks: Record<string, { status: string; detail?: string }> = {};

  // Supabase
  try {
    const { count, error } = await supabaseAdmin
      .from("isw_transactions")
      .select("*", { count: "exact", head: true });
    checks.supabase = error
      ? { status: "error", detail: error.message }
      : { status: "ok", detail: `${count} ISW transactions` };
  } catch (e) {
    checks.supabase = { status: "error", detail: (e as Error).message };
  }

  // OpenRouter
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    });
    checks.ai_agent = res.ok
      ? { status: "ok", detail: "OpenRouter reachable" }
      : { status: "degraded", detail: `HTTP ${res.status}` };
  } catch {
    checks.ai_agent = { status: "error", detail: "OpenRouter unreachable" };
  }

  // Interswitch
  checks.interswitch = process.env.ISW_MERCHANT_CODE
    ? { status: "ok", detail: `Merchant ${process.env.ISW_MERCHANT_CODE}` }
    : { status: "missing", detail: "ISW_MERCHANT_CODE not set" };

  // Mono
  checks.mono = process.env.MONO_SECRET_KEY
    ? { status: "ok", detail: "Secret key configured" }
    : { status: "missing", detail: "MONO_SECRET_KEY not set" };

  // Audit chain
  try {
    const { count } = await supabaseAdmin
      .from("audit_chain")
      .select("*", { count: "exact", head: true });
    checks.audit_chain = { status: "ok", detail: `${count} entries` };
  } catch {
    checks.audit_chain = { status: "error" };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json({
    status: allOk ? "healthy" : "degraded",
    version: "1.0.0",
    engine: "SettleGuard Reconciliation Engine",
    checks,
  });
}
