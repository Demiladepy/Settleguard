import CryptoJS from "crypto-js";
import { supabaseAdmin, type AuditEntry } from "./supabase";

/**
 * Tamper-evident audit chain using SHA-256 hash linking.
 * Each entry's hash includes the previous entry's hash,
 * creating a verifiable chain of custody for all operations.
 */

function computeHash(entry: {
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  payload: Record<string, unknown>;
  prev_hash: string;
}): string {
  const data = JSON.stringify({
    event_type: entry.event_type,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    actor: entry.actor,
    payload: entry.payload,
    prev_hash: entry.prev_hash,
  });
  return CryptoJS.SHA256(data).toString();
}

/**
 * Append a new entry to the audit chain
 */
export async function appendToAuditChain(params: {
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  payload: Record<string, unknown>;
}): Promise<AuditEntry> {
  // Get the last entry's hash (or genesis hash)
  const { data: lastEntry } = await supabaseAdmin
    .from("audit_chain")
    .select("hash")
    .order("id", { ascending: false })
    .limit(1)
    .single();

  const prev_hash = lastEntry?.hash || "GENESIS_0000000000000000";

  const hash = computeHash({
    ...params,
    prev_hash,
  });

  const { data, error } = await supabaseAdmin
    .from("audit_chain")
    .insert({
      ...params,
      prev_hash,
      hash,
    })
    .select()
    .single();

  if (error) throw new Error(`Audit chain append failed: ${error.message}`);
  return data;
}

/**
 * Verify the integrity of the entire audit chain.
 * Returns the first broken link if any, or null if chain is valid.
 */
export async function verifyAuditChain(): Promise<{
  valid: boolean;
  brokenAt: number | null;
  totalEntries: number;
  details?: string;
}> {
  const { data: entries, error } = await supabaseAdmin
    .from("audit_chain")
    .select("*")
    .order("id", { ascending: true });

  if (error) throw new Error(`Failed to read audit chain: ${error.message}`);
  if (!entries || entries.length === 0) {
    return { valid: true, brokenAt: null, totalEntries: 0 };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Verify prev_hash linkage
    if (i === 0) {
      if (entry.prev_hash !== "GENESIS_0000000000000000") {
        return {
          valid: false,
          brokenAt: entry.id,
          totalEntries: entries.length,
          details: `First entry has invalid prev_hash: ${entry.prev_hash}`,
        };
      }
    } else {
      if (entry.prev_hash !== entries[i - 1].hash) {
        return {
          valid: false,
          brokenAt: entry.id,
          totalEntries: entries.length,
          details: `Entry #${entry.id} prev_hash doesn't match previous entry's hash`,
        };
      }
    }

    // Verify hash integrity
    const expectedHash = computeHash({
      event_type: entry.event_type,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      actor: entry.actor,
      payload: entry.payload,
      prev_hash: entry.prev_hash,
    });

    if (entry.hash !== expectedHash) {
      return {
        valid: false,
        brokenAt: entry.id,
        totalEntries: entries.length,
        details: `Entry #${entry.id} hash mismatch — record was tampered with`,
      };
    }
  }

  return { valid: true, brokenAt: null, totalEntries: entries.length };
}

/**
 * Get recent audit entries
 */
export async function getRecentAuditEntries(limit = 50): Promise<AuditEntry[]> {
  const { data, error } = await supabaseAdmin
    .from("audit_chain")
    .select("*")
    .order("id", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch audit entries: ${error.message}`);
  return data || [];
}
