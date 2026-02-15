import { NextRequest, NextResponse } from "next/server";
import { verifyCode, findOrCreateUser, createToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();

  if (!email || !code) {
    return NextResponse.json({ error: "Email and code required" }, { status: 400 });
  }

  if (!verifyCode(email, code)) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  const user = findOrCreateUser(email);
  const token = await createToken(user);

  const res = NextResponse.json({
    user: { id: user.id, email: user.email },
  });

  res.cookies.set("clawster_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return res;
}
