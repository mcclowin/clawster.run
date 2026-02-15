/**
 * Auth — Telegram Login Widget + JWT sessions
 *
 * Flow:
 * 1. User clicks "Login with Telegram" widget on frontend
 * 2. Telegram sends auth data to our callback
 * 3. We verify the HMAC, create/find user, issue JWT
 * 4. JWT stored in httpOnly cookie
 */

import crypto from "crypto";
import * as jose from "jose";
import { getDb, generateId } from "./db";

const JWT_ALG = "HS256";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return new TextEncoder().encode(secret);
}

// ── Telegram verification ──

interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/** Verify Telegram Login Widget callback */
export function verifyTelegramAuth(data: TelegramAuthData): boolean {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  // Build check string (all fields except hash, sorted alphabetically)
  const { hash, ...rest } = data;
  const checkString = Object.entries(rest)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  // HMAC-SHA256 with SHA256(bot_token) as key
  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

  if (hmac !== hash) return false;

  // Check auth_date is recent (within 1 hour)
  const now = Math.floor(Date.now() / 1000);
  if (now - data.auth_date > 3600) return false;

  return true;
}

// ── User management ──

export interface User {
  id: string;
  telegram_id: string;
  telegram_username: string | null;
  stripe_customer_id: string | null;
}

/** Find or create user from Telegram auth */
export function findOrCreateUser(telegramId: string, username?: string): User {
  const db = getDb();

  // Try find
  const existing = db
    .prepare("SELECT * FROM users WHERE telegram_id = ?")
    .get(telegramId) as User | undefined;

  if (existing) {
    // Update username if changed
    if (username && username !== existing.telegram_username) {
      db.prepare("UPDATE users SET telegram_username = ?, updated_at = datetime('now') WHERE id = ?")
        .run(username, existing.id);
      existing.telegram_username = username;
    }
    return existing;
  }

  // Create
  const id = generateId();
  db.prepare(
    "INSERT INTO users (id, telegram_id, telegram_username) VALUES (?, ?, ?)"
  ).run(id, telegramId, username || null);

  return { id, telegram_id: telegramId, telegram_username: username || null, stripe_customer_id: null };
}

// ── JWT ──

export async function createToken(user: User): Promise<string> {
  return new jose.SignJWT({
    sub: user.id,
    tg: user.telegram_id,
  })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<{ sub: string; tg: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret());
    return { sub: payload.sub as string, tg: payload.tg as string };
  } catch {
    return null;
  }
}

/** Extract user from request cookies */
export async function getAuthUser(cookies: { get(name: string): { value: string } | undefined }): Promise<User | null> {
  const token = cookies.get("clawster_session")?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub) as User | undefined || null;
}
