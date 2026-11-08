import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

/**
 * Neon Postgres (node-postgres over the pooled connection string: the backend
 * is a long-running Node server, so one pool is reused across requests).
 * Only used when DATABASE_URL is set; otherwise the store stays a JSON file.
 */

export const dbEnabled = () => !!process.env.DATABASE_URL;

const g = globalThis as unknown as { __udyamPool?: Pool };
export function pool() {
  // verify-full: what pg does today for "require", stated explicitly (pg 9 weakens "require").
  const connectionString = process.env.DATABASE_URL?.replace(/sslmode=(require|prefer|verify-ca)/, "sslmode=verify-full");
  g.__udyamPool ??= new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 15_000 });
  return g.__udyamPool;
}

export async function migrate() {
  const sql = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  await pool().query(sql);
}

export type RecordKind = "session" | "order" | "consent" | "customer";

export async function loadRecords(): Promise<{ kind: RecordKind; data: unknown }[]> {
  const { rows } = await pool().query<{ kind: RecordKind; data: unknown }>("SELECT kind, data FROM records ORDER BY seq");
  return rows;
}

export async function loadAudit(limit: number) {
  const { rows } = await pool().query<{ at: Date; actor: string; action: string; ref: string; detail: string }>(
    "SELECT at, actor, action, ref, detail FROM (SELECT * FROM audit_log ORDER BY id DESC LIMIT $1) t ORDER BY id",
    [limit],
  );
  return rows.map((r) => ({ ...r, at: r.at.toISOString() }));
}

export async function upsertRecords(rows: { kind: RecordKind; id: string; data: unknown }[]) {
  if (!rows.length) return;
  // One statement per flush: unnest the batch into an upsert.
  await pool().query(
    `INSERT INTO records (kind, id, data, updated_at)
     SELECT k, i, d, now() FROM unnest($1::text[], $2::text[], $3::jsonb[]) AS t(k, i, d)
     ON CONFLICT (kind, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [rows.map((r) => r.kind), rows.map((r) => r.id), rows.map((r) => JSON.stringify(r.data))],
  );
}

export async function deleteRecord(kind: RecordKind, id: string) {
  await pool().query("DELETE FROM records WHERE kind = $1 AND id = $2", [kind, id]);
}

export async function insertAudit(rows: { at: string; actor: string; action: string; ref: string; detail: string }[]) {
  if (!rows.length) return;
  await pool().query(
    `INSERT INTO audit_log (at, actor, action, ref, detail)
     SELECT * FROM unnest($1::timestamptz[], $2::text[], $3::text[], $4::text[], $5::text[])`,
    [rows.map((r) => r.at), rows.map((r) => r.actor), rows.map((r) => r.action), rows.map((r) => r.ref), rows.map((r) => r.detail)],
  );
}
