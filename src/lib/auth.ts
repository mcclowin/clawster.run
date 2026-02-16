/**
 * Auth — User management + JWT sessions
 * OTP handled by Stytch (see email.ts)
 */

import * as jose from "jose";
import { dbRun, dbGet, generateId } from "./db";

const JWT_ALG = "HS256";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return new TextEncoder().encode(secret);
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
