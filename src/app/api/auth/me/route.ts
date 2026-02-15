/**
 * GET /api/auth/me
 *
 * Returns current authenticated user, or 401.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET(_req: NextRequest) {
  const user = await getAuthUser(await cookies());

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      telegram_id: user.telegram_id,
      username: user.telegram_username,
      has_billing: !!user.stripe_customer_id,
    },
  });
}
