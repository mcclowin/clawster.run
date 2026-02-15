import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import * as billing from "@/lib/stripe";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!user.stripe_customer_id) return NextResponse.json({ error: "No billing" }, { status: 400 });

  const origin = req.headers.get("origin") || "https://clawster.run";
  const url = await billing.getPortalUrl(user.stripe_customer_id, `${origin}/dashboard`);
  return NextResponse.json({ url });
}
