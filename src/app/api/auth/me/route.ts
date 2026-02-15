import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  return NextResponse.json({
    user: {
      id: user.id,
      telegram_id: user.telegram_id,
      username: user.telegram_username,
      has_billing: !!user.stripe_customer_id,
    },
  });
}
