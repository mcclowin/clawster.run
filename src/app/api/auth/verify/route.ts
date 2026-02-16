import { NextRequest, NextResponse } from "next/server";
import { verifyOtp } from "@/lib/email";
import { findOrCreateUser, createToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { methodId, code } = await req.json();

    if (!methodId || !code) {
      return NextResponse.json({ error: "methodId and code required" }, { status: 400 });
    }

    // Stytch verifies the code
    const { email } = await verifyOtp(methodId, code);

    // Create/find our user
    const user = await findOrCreateUser(email);
    const token = await createToken(user);

    const res = NextResponse.json({
      user: { id: user.id, email: user.email },
    });

    res.cookies.set("clawster_session", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return res;
  } catch (err) {
    console.error("[verify]", err);
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }
}
