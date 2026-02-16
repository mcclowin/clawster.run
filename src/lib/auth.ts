/**
 * Auth — Email magic code + JWT sessions
 */

import crypto from "crypto";
import * as jose from "jose";
import { dbRun, dbGet, generateId } from "./db";

const JWT_ALG = "HS256";
const CODE_EXPIRY_MS = 10 * 60 * 1000;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return new TextEncoder().encode(secret);
}

// ── Magic code ──

export function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function storeCode(email: string, code: string): Promise<void> {
  await dbRun("DELETE FROM auth_codes WHERE email = ?", email.toLowerCase());
  await dbRun(
    "INSERT INTO auth_codes (id, email, code, expires_at) VALUES (?, ?, ?, ?)",
    generateId(), email.toLowerCase(), code, new Date(Date.now() + CODE_EXPIRY_MS).toISOString()
  );
}

export async function verifyCode(email: string, code: string): Promise<boolean> {
  const record = await dbGet<{ id: string }>(
    "SELECT * FROM auth_codes WHERE email = ? AND code = ? AND expires_at > datetime('now')",
    email.toLowerCase(), code
  );
  if (!record) return false;
  await dbRun("DELETE FROM auth_codes WHERE id = ?", record.id);
  return true;
}

// ── User ──

export interface User {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  created_at: string;
}

export async function findOrCreateUser(email: string): Promise<User> {
  const normalized = email.toLowerCase();
  const existing = await dbGet<User>("SELECT * FROM users WHERE email = ?", normalized);
  if (existing) return existing;

  const id = generateId();
  const now = new Date().toISOString();
  await dbRun("INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)", id, normalized, now, now);
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

// ── Server-side auth ──

import { cookies } from "next/headers";

export async function getAuthUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("clawster_session")?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const user = await dbGet<User>("SELECT * FROM users WHERE id = ?", payload.sub);
  return user || null;
}
