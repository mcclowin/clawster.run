/**
 * POST /api/billing/checkout
 *
 * Create Stripe checkout session for metered subscription.
 * Redirects user to Stripe to add payment method.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import * as stripe from "@/lib/stripe";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(await cookies());
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const origin = req.headers.get("origin") || "https://clawster.run";

  // Ensure Stripe customer exists
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    customerId = await stripe.ensureCustomer(user.id, user.telegram_username || undefined);

    const db = getDb();
    db.prepare("UPDATE users SET stripe_customer_id = ?, updated_at = datetime('now') WHERE id = ?")
      .run(customerId, user.id);
  }

  // Create checkout
  const url = await stripe.createCheckout(
    customerId,
    `${origin}/dashboard?billing=success`,
    `${origin}/dashboard?billing=cancelled`
  );

  return NextResponse.json({ url });
}
