import { supabaseAdmin } from "./supabase";
import { koboToNaira } from "./interswitch";
import { decomposeSettlement } from "./settlement-decomposer";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ── Tool definitions (OpenAI function-calling format) ───────────────

interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

const tools: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "query_isw_transaction",
      description: "Get Interswitch transaction details by reference or batch ID",
      parameters: {
        type: "object",
        properties: {
          txn_ref: { type: "string", description: "Transaction reference" },
          batch_id: { type: "string", description: "Settlement batch ID" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_bank_transactions",
      description:
        "Search bank transactions by date range, amount, or narration keyword",
      parameters: {
        type: "object",
        properties: {
          date_from: { type: "string" },
          date_to: { type: "string" },
          amount_kobo: { type: "integer" },
          narration_contains: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_erp_invoices",
      description: "Search Zoho Books invoices by customer, amount, or status",
      parameters: {
        type: "object",
        properties: {
          customer_email: { type: "string" },
          amount_kobo: { type: "integer" },
          status: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_customer_dispute_history",
      description: "Get all past disputes for a customer email",
      parameters: {
        type: "object",
        properties: {
          customer_email: { type: "string" },
        },
        required: ["customer_email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_settlement_breakdown",
      description:
        "Decompose a bank settlement into individual ISW transactions by batch ID",
      parameters: {
        type: "object",
        properties: {
          batch_id: { type: "string" },
        },
        required: ["batch_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_refund",
      description:
        "Issue a refund via Interswitch for a specific transaction. Only call if confidence > 0.9",
      parameters: {
        type: "object",
        properties: {
          txn_ref: { type: "string" },
          amount_kobo: { type: "integer" },
          reason: { type: "string" },
        },
        required: ["txn_ref", "amount_kobo", "reason"],
      },
    },
  },
];

// ── Tool execution ───────────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "query_isw_transaction": {
      let query = supabaseAdmin.from("isw_transactions").select("*");
      if (input.txn_ref) query = query.eq("txn_ref", input.txn_ref);
      if (input.batch_id)
        query = query.eq("settlement_batch_id", input.batch_id);
      const { data, error } = await query.limit(50);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(
        (data || []).map((t) => ({
          ...t,
          amount_display: koboToNaira(t.amount_kobo),
        }))
      );
    }

    case "query_bank_transactions": {
      let query = supabaseAdmin.from("bank_transactions").select("*");
      if (input.date_from)
        query = query.gte("transaction_date", input.date_from);
      if (input.date_to) query = query.lte("transaction_date", input.date_to);
      if (input.amount_kobo) query = query.eq("amount_kobo", input.amount_kobo);
      if (input.narration_contains)
        query = query.ilike("narration", `%${input.narration_contains}%`);
      const { data, error } = await query.limit(50);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(
        (data || []).map((t) => ({
          ...t,
          amount_display: koboToNaira(t.amount_kobo),
        }))
      );
    }

    case "query_erp_invoices": {
      let query = supabaseAdmin.from("erp_invoices").select("*");
      if (input.customer_email)
        query = query.eq("customer_email", input.customer_email);
      if (input.amount_kobo) query = query.eq("amount_kobo", input.amount_kobo);
      if (input.status) query = query.eq("status", input.status);
      const { data, error } = await query.limit(50);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(
        (data || []).map((i) => ({
          ...i,
          amount_display: koboToNaira(i.amount_kobo),
        }))
      );
    }

    case "get_customer_dispute_history": {
      const email = input.customer_email as string;
      const { data: iswTxns } = await supabaseAdmin
        .from("isw_transactions")
        .select("id")
        .contains("raw_response", { cust_email: email });

      if (!iswTxns || iswTxns.length === 0)
        return JSON.stringify({ disputes: [], note: "No transactions found for this customer" });

      const iswIds = iswTxns.map((t) => t.id);
      const { data: disputes } = await supabaseAdmin
        .from("disputes")
        .select("*")
        .in("isw_transaction_id", iswIds)
        .order("created_at", { ascending: false });

      return JSON.stringify({ disputes: disputes || [], total: disputes?.length || 0 });
    }

    case "calculate_settlement_breakdown": {
      const breakdown = await decomposeSettlement(input.batch_id as string);
      if (!breakdown)
        return JSON.stringify({ error: "No transactions found for this batch" });
      return JSON.stringify({
        batch_id: breakdown.batchId,
        transaction_count: breakdown.iswTransactions.length,
        total_isw_amount: koboToNaira(breakdown.totalIswAmount),
        bank_amount: koboToNaira(breakdown.bankAmount),
        difference: koboToNaira(Math.abs(breakdown.difference)),
        is_balanced: breakdown.isBalanced,
        transactions: breakdown.iswTransactions.map((t) => ({
          txn_ref: t.txn_ref,
          amount: koboToNaira(t.amount_kobo),
          date: t.transaction_date,
          response_code: t.response_code,
        })),
      });
    }

    case "execute_refund": {
      return JSON.stringify({
        status: "refund_initiated",
        txn_ref: input.txn_ref,
        amount: koboToNaira(input.amount_kobo as number),
        reason: input.reason,
        note: "Refund queued for processing (sandbox mode)",
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// ── OpenRouter API call ─────────────────────────────────────────────

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

async function chatCompletion(messages: ChatMessage[]) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://settleguard.ng",
      "X-Title": "SettleGuard AI Agent",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4",
      max_tokens: 4096,
      messages,
      tools,
      tool_choice: "auto",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${errText}`);
  }

  return res.json();
}

// ── Agent loop ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are SettleGuard's financial reconciliation agent. You investigate payment
discrepancies across three data sources:

1. INTERSWITCH (payment gateway) — what customers paid
2. BANK ACCOUNT (via Mono) — what actually arrived in the business's bank
3. ZOHO BOOKS (ERP) — what the business invoiced and expects

When investigating a dispute, you MUST:
- Query all three sources to build a complete picture
- Check for settlement batching (one bank credit = many ISW transactions)
- Look for timing differences (settlements take 1-3 business days)
- Check customer dispute history for patterns
- Calculate exact amounts — kobo-level precision matters

Your recommendation must be one of:
- REFUND: clear evidence the customer was wrongly charged
- REJECT: the charge is valid, customer claim is unfounded
- ESCALATE: ambiguous situation requiring human review
- WAIT: settlement likely pending, re-check in 24-48 hours
- AUTO_RESOLVED: found the match, it was just a timing/format issue

Always provide a confidence score (0.0 to 1.0).
Only call execute_refund if confidence > 0.9 AND recommendation is REFUND.

Format your final answer as JSON:
{
  "recommendation": "REFUND|REJECT|ESCALATE|WAIT|AUTO_RESOLVED",
  "confidence": 0.0-1.0,
  "summary": "brief explanation",
  "evidence": ["list of key findings"]
}`;

export interface AgentResult {
  recommendation: string;
  confidence: number;
  summary: string;
  evidence: string[];
  toolCalls: Array<{ tool: string; input: Record<string, unknown>; output: string }>;
}

/**
 * Run the AI dispute investigation agent via OpenRouter.
 * Returns the agent's recommendation + full tool call trace for transparency.
 */
export async function investigateDispute(
  disputeReason: string,
  context: {
    txn_ref?: string;
    customer_email?: string;
    amount_kobo?: number;
    batch_id?: string;
    match_status?: string;
  }
): Promise<AgentResult> {
  const userMessage = `Investigate this dispute:

Reason: ${disputeReason}
${context.txn_ref ? `ISW Transaction Ref: ${context.txn_ref}` : ""}
${context.customer_email ? `Customer Email: ${context.customer_email}` : ""}
${context.amount_kobo ? `Expected Amount: ${koboToNaira(context.amount_kobo)}` : ""}
${context.batch_id ? `Settlement Batch: ${context.batch_id}` : ""}
${context.match_status ? `Current Match Status: ${context.match_status}` : ""}

Query all three data sources and investigate thoroughly.`;

  const toolCallTrace: AgentResult["toolCalls"] = [];

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  // Agent loop — max 10 iterations to prevent runaway
  for (let i = 0; i < 10; i++) {
    const data = await chatCompletion(messages);
    const choice = data.choices?.[0];

    if (!choice) {
      break;
    }

    const message = choice.message;
    const finishReason = choice.finish_reason;

    // Add assistant message to conversation
    messages.push(message);

    // Check if the model wants to call tools
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Execute each tool call
      for (const toolCall of message.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown> = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          fnArgs = {};
        }

        const output = await executeTool(fnName, fnArgs);
        toolCallTrace.push({ tool: fnName, input: fnArgs, output });

        // Add tool result to conversation
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: output,
        });
      }
      continue;
    }

    // No tool calls — agent is done
    if (finishReason === "stop" || !message.tool_calls) {
      const finalText = message.content || "";
      try {
        const jsonMatch = finalText.match(/\{[\s\S]*"recommendation"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return { ...parsed, toolCalls: toolCallTrace };
        }
      } catch {
        // Fall through to default
      }
      return {
        recommendation: "ESCALATE",
        confidence: 0.3,
        summary: finalText || "Agent could not reach a conclusion",
        evidence: [],
        toolCalls: toolCallTrace,
      };
    }
  }

  return {
    recommendation: "ESCALATE",
    confidence: 0.2,
    summary: "Agent hit maximum iteration limit",
    evidence: [],
    toolCalls: toolCallTrace,
  };
}
