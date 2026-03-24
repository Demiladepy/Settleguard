/**
 * Neon serverless driver for points DB.
 * Uses POSTGRES_URL or DATABASE_URL from env.
 */

import { neon } from "@neondatabase/serverless";

function getConnectionString(): string {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("POSTGRES_URL or DATABASE_URL is required for points DB");
  }
  return url;
}

export function getSql() {
  return neon(getConnectionString());
}

type SqlClient = ReturnType<typeof getSql>;

/** Ensure points tables exist (idempotent). Call from API routes. */
export async function ensurePointsTables(sql: SqlClient) {
  await sql`
    CREATE TABLE IF NOT EXISTS points (
      wallet_address TEXT PRIMARY KEY,
      points INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS swap_claims (
      tx_signature TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

/** Volume: one row for totals, one row per day. No per-swap rows (storage-efficient). */
export async function ensureVolumeTables(sql: SqlClient) {
  await sql`
    CREATE TABLE IF NOT EXISTS volume_stats (
      id INTEGER PRIMARY KEY DEFAULT 1,
      total_volume_usd NUMERIC NOT NULL DEFAULT 0,
      total_swaps INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT single_row CHECK (id = 1)
    )
  `;
  await sql`
    INSERT INTO volume_stats (id, total_volume_usd, total_swaps, updated_at)
    VALUES (1, 0, 0, NOW())
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS volume_daily (
      day DATE PRIMARY KEY,
      volume_usd NUMERIC NOT NULL DEFAULT 0,
      swap_count INTEGER NOT NULL DEFAULT 0
    )
  `;
}
