/**
 * POST /api/billing/webhook
 *
 * Stripe webhook handler.
 * Handles: subscription created/deleted, payment failed, invoice paid.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
      // Subscription activated — user can now spawn bots
      console.log("[stripe] Subscription created:", (event.data.object as Stripe.Subscription).id);
      break;

    case "customer.subscription.deleted":
      // Subscription cancelled — terminate all user's bots after grace period
      console.log("[stripe] Subscription deleted:", (event.data.object as Stripe.Subscription).id);
      // TODO: Mark user's bots for termination, send warning via Telegram
      break;

    case "invoice.payment_failed":
      // Payment failed — warn user, grace period before termination
      console.log("[stripe] Payment failed:", (event.data.object as Stripe.Invoice).id);
      // TODO: Notify user via Telegram bot
      break;

    case "invoice.paid":
      console.log("[stripe] Invoice paid:", (event.data.object as Stripe.Invoice).id);
      break;

    default:
      // Unhandled event type
      break;
  }

  return NextResponse.json({ received: true });
}
