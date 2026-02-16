import { NextRequest, NextResponse } from "next/server";
import { generateCode, storeCode } from "@/lib/auth";
import { sendCode } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const code = generateCode();
    await storeCode(email, code);
    await sendCode(email, code);

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[send-code]", err);
    return NextResponse.json({ error: "Failed to send code" }, { status: 500 });
  }
}
