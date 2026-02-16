import { NextRequest, NextResponse } from "next/server";
import { sendOtp } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const { methodId } = await sendOtp(email);

    return NextResponse.json({ sent: true, methodId });
  } catch (err) {
    console.error("[send-code]", err);
    return NextResponse.json({ error: "Failed to send code" }, { status: 500 });
  }
}
