/**
 * POST /api/auth/telegram
 *
 * Telegram Login Widget callback.
 * Verifies auth data, creates user, returns JWT in cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramAuth, findOrCreateUser, createToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const data = await req.json();

  // Verify Telegram HMAC
  if (!verifyTelegramAuth(data)) {
    return NextResponse.json({ error: "Invalid Telegram auth" }, { status: 401 });
  }

  // Find or create user
  const user = findOrCreateUser(String(data.id), data.username);

  // Issue JWT
  const token = await createToken(user);

  const res = NextResponse.json({
    user: {
      id: user.id,
      telegram_id: user.telegram_id,
      username: user.telegram_username,
    },
  });

  // Set httpOnly cookie
  res.cookies.set("clawster_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });

  return res;
}
