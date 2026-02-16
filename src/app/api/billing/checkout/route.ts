import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { dbRun } from "@/lib/db";
import * as billing from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const origin = req.headers.get("origin") || "https://clawster.run";

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    customerId = await billing.ensureCustomer(user.id, user.email);
    await dbRun("UPDATE users SET stripe_customer_id = ?, updated_at = datetime('now') WHERE id = ?", customerId, user.id);
  }

  const url = await billing.createCheckout(customerId, `${origin}/dashboard?billing=success`, `${origin}/dashboard?billing=cancelled`);
  return NextResponse.json({ url });
}
