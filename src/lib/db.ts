/**
 * Clawster Database — SQLite via better-sqlite3
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "clawster.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    migrate(_db);
  }
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                  TEXT PRIMARY KEY,
      email               TEXT UNIQUE NOT NULL,
      stripe_customer_id  TEXT,
      created_at          TEXT DEFAULT (datetime('now')),
      updated_at          TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auth_codes (
      id          TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      code        TEXT NOT NULL,
      expires_at  TEXT NOT NULL
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

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_codes_email ON auth_codes(email);
    CREATE INDEX IF NOT EXISTS idx_bots_user ON bots(user_id);
    CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status);
    CREATE INDEX IF NOT EXISTS idx_usage_bot ON usage_records(bot_id);
  `);
}

export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}
