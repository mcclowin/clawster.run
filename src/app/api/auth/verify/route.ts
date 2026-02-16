import { NextRequest, NextResponse } from "next/server";
import { verifyCode, findOrCreateUser, createToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ error: "Email and code required" }, { status: 400 });
    }

    const valid = await verifyCode(email, code);
    if (!valid) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
    }

    const user = await findOrCreateUser(email);
    const token = await createToken(user);

    const res = NextResponse.json({
      user: { id: user.id, email: user.email },
    });

    res.cookies.set("clawster_session", token, {
      httpOnly: true,
      secure: false, // dev mode — no HTTPS
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return res;
  } catch (err) {
    console.error("[verify]", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
