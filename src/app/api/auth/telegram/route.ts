import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramAuth, findOrCreateUser, createToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    if (!verifyTelegramAuth(data)) {
      return NextResponse.json({ error: "Invalid Telegram auth" }, { status: 401 });
    }

    const user = findOrCreateUser(String(data.id), data.username);
    const token = await createToken(user);

    const res = NextResponse.json({
      user: { id: user.id, telegram_id: user.telegram_id, username: user.telegram_username },
    });

    res.cookies.set("clawster_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return res;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
