/**
 * Auth — Email magic code + JWT sessions
 *
 * Flow:
 * 1. User enters email on /login
 * 2. POST /api/auth/send-code → we email a 6-digit code
 * 3. POST /api/auth/verify → check code, issue JWT
 * 4. JWT in httpOnly cookie (same origin, no CORS issues)
 */

import crypto from "crypto";
import * as jose from "jose";
import { getDb, generateId } from "./db";

const JWT_ALG = "HS256";
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return new TextEncoder().encode(secret);
}

// ── Magic code ──

export function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function storeCode(email: string, code: string): void {
  const db = getDb();

  // Delete any existing codes for this email
  db.prepare("DELETE FROM auth_codes WHERE email = ?").run(email.toLowerCase());

  // Store new code
  db.prepare(
    "INSERT INTO auth_codes (id, email, code, expires_at) VALUES (?, ?, ?, ?)"
  ).run(generateId(), email.toLowerCase(), code, new Date(Date.now() + CODE_EXPIRY_MS).toISOString());
}

export function verifyCode(email: string, code: string): boolean {
  const db = getDb();

  const record = db
    .prepare("SELECT * FROM auth_codes WHERE email = ? AND code = ? AND expires_at > datetime('now')")
    .get(email.toLowerCase(), code) as { id: string } | undefined;

  if (!record) return false;

  // Delete used code
  db.prepare("DELETE FROM auth_codes WHERE id = ?").run(record.id);
  return true;
}

// ── User CRUD ──

export interface User {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  created_at: string;
}

export function findOrCreateUser(email: string): User {
  const db = getDb();
  const normalized = email.toLowerCase();

  const existing = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalized) as User | undefined;

  if (existing) return existing;

  const id = generateId();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(id, normalized, now, now);

  return { id, email: normalized, stripe_customer_id: null, created_at: now };
}

// ── JWT ──

export async function createToken(user: User): Promise<string> {
  return new jose.SignJWT({ sub: user.id, email: user.email })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<{ sub: string; email: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret());
    return { sub: payload.sub as string, email: payload.email as string };
  } catch {
    return null;
  }
}

// ── Server-side auth helper ──

import { cookies } from "next/headers";

export async function getAuthUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("clawster_session")?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub) as User | undefined || null;
}
