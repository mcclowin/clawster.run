/**
 * Clawster Database — SQLite via sql.js (pure JS, no native deps)
 */

import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import fs from "fs";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "clawster.db");

let _db: SqlJsDatabase | null = null;
let _sqlReady: Promise<typeof import("sql.js")> | null = null;

function getSqlJs() {
  if (!_sqlReady) {
    _sqlReady = initSqlJs();
  }
  return _sqlReady;
}

export async function getDb(): Promise<SqlJsDatabase> {
  if (_db) return _db;

  const SQL = await getSqlJs();

  // Load existing DB or create new
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(buffer);
  } else {
    _db = new SQL.Database();
  }

  migrate(_db);
  return _db;
}

/** Save DB to disk */
export function saveDb(): void {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function migrate(db: SqlJsDatabase) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id                  TEXT PRIMARY KEY,
      email               TEXT UNIQUE NOT NULL,
      stripe_customer_id  TEXT,
      created_at          TEXT DEFAULT (datetime('now')),
      updated_at          TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bots (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES users(id),
      name            TEXT NOT NULL,
      phala_cvm_id    TEXT,
      phala_app_id    TEXT,
      status          TEXT DEFAULT 'pending',
      model           TEXT,
      instance_size   TEXT DEFAULT 'small',
      tee_pubkey      TEXT,
      cvm_endpoint    TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now')),
      terminated_at   TEXT,
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS usage_records (
      id                TEXT PRIMARY KEY,
      bot_id            TEXT NOT NULL REFERENCES bots(id),
      period_start      TEXT NOT NULL,
      period_end        TEXT NOT NULL,
      hours             REAL NOT NULL,
      cost_usd          REAL NOT NULL,
      stripe_usage_id   TEXT,
      metered_at        TEXT DEFAULT (datetime('now'))
    );
  `);
  saveDb();
}

export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

// ── Query helpers ──

function sanitizeParams(params: unknown[]): (string | number | null)[] {
  return params.map(p => p === undefined ? null : p as string | number | null);
}

export async function dbRun(sql: string, ...params: unknown[]): Promise<void> {
  const db = await getDb();
  db.run(sql, sanitizeParams(params));
  saveDb();
}

export async function dbGet<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | undefined> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(sanitizeParams(params));
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    stmt.free();
    const row: Record<string, unknown> = {};
    cols.forEach((col, i) => row[col] = vals[i]);
    return row as T;
  }
  stmt.free();
  return undefined;
}

export async function dbAll<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(sanitizeParams(params));
  const results: T[] = [];
  while (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const row: Record<string, unknown> = {};
    cols.forEach((col, i) => row[col] = vals[i]);
    results.push(row as T);
  }
  stmt.free();
  return results;
}
