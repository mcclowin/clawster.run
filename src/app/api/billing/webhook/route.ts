import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
      console.log("[stripe] Sub created:", (event.data.object as Stripe.Subscription).id);
      break;
    case "customer.subscription.deleted":
      console.log("[stripe] Sub deleted — terminate bots after grace period");
      // TODO: mark user's bots for termination
      break;
    case "invoice.payment_failed":
      console.log("[stripe] Payment failed — notify user");
      // TODO: send Telegram notification
      break;
    case "invoice.paid":
      console.log("[stripe] Paid:", (event.data.object as Stripe.Invoice).id);
      break;
  }

  return NextResponse.json({ received: true });
}
