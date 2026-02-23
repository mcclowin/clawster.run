/**
 * Stripe Billing — Metered usage billing for bot hosting
 *
 * Model: Stripe metered subscription
 * - User subscribes to "Clawster Bot Hosting" product
 * - We report usage (bot-hours) every hour
 * - Stripe bills at end of billing period
 */

import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    _stripe = new Stripe(key, { apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion });
  }
  return _stripe;
}

/** Create or get Stripe customer for a user */
export async function ensureCustomer(userId: string, telegramUsername?: string): Promise<string> {
  const stripe = getStripe();

  // Search for existing
  const existing = await stripe.customers.search({
    query: `metadata["clawster_user_id"]:"${userId}"`,
  });

  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  // Create new
  const customer = await stripe.customers.create({
    name: telegramUsername ? `@${telegramUsername}` : `clawster-${userId}`,
    metadata: { clawster_user_id: userId },
  });

  return customer.id;
}

/** Create a metered subscription for the customer */
export async function createSubscription(customerId: string): Promise<{
  subscriptionId: string;
  subscriptionItemId: string;
}> {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) throw new Error("STRIPE_PRICE_ID not configured");

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    expand: ["latest_invoice.payment_intent"],
  });

  return {
    subscriptionId: subscription.id,
    subscriptionItemId: subscription.items.data[0].id,
  };
}

/** Report usage (bot-hours) to Stripe */
export async function reportUsage(
  subscriptionItemId: string,
  quantity: number, // bot-hours
  timestamp?: number
): Promise<void> {
  const stripe = getStripe();

  await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
    quantity: Math.ceil(quantity),
    timestamp: timestamp || Math.floor(Date.now() / 1000),
    action: "increment",
  });
}

/** Create a checkout session for new subscribers (legacy) */
export async function createCheckout(
  customerId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) throw new Error("STRIPE_PRICE_ID not configured");

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId }],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session.url!;
}

/**
 * Create a Checkout session for a specific bot subscription.
 * Uses the appropriate price ID based on instance size.
 * Stores botId in metadata so webhook can trigger deploy.
 */
export async function createBotCheckout(
  customerId: string,
  botId: string,
  instanceSize: string,
  _retailPerHour: number,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const stripe = getStripe();

  // Use size-specific price IDs: STRIPE_PRICE_ID_SMALL, STRIPE_PRICE_ID_MEDIUM
  // Falls back to STRIPE_PRICE_ID for backward compat
  const priceId = instanceSize === "medium"
    ? (process.env.STRIPE_PRICE_ID_MEDIUM || process.env.STRIPE_PRICE_ID)
    : (process.env.STRIPE_PRICE_ID_SMALL || process.env.STRIPE_PRICE_ID);

  if (!priceId) throw new Error("STRIPE_PRICE_ID not configured");

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: { clawster_bot_id: botId, instance_size: instanceSize },
    },
    metadata: { clawster_bot_id: botId },
    success_url: successUrl,
    cancel_url: cancelUrl,
    consent_collection: { terms_of_service: "required" },
  });

  return session.url!;
}

/** Get customer's billing portal URL */
export async function getPortalUrl(customerId: string, returnUrl: string): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

/** Check if customer has active subscription */
export async function hasActiveSubscription(customerId: string): Promise<boolean> {
  const stripe = getStripe();

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });

  return subs.data.length > 0;
}
