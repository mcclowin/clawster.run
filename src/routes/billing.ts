import { Router, Request, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware.js";
import { getDb } from "../lib/db.js";
import * as billing from "../lib/stripe.js";
import Stripe from "stripe";

export const billingRoutes = Router();

const COST_PER_HOUR: Record<string, number> = { small: 0.12, medium: 0.24 };

/**
 * POST /billing/checkout — Create Stripe checkout session
 */
billingRoutes.post("/checkout", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const origin = req.headers.origin || "https://clawster.run";

    let customerId = req.user!.stripe_customer_id;
    if (!customerId) {
      customerId = await billing.ensureCustomer(req.user!.id, req.user!.telegram_username || undefined);
      const db = getDb();
      db.prepare("UPDATE users SET stripe_customer_id = ?, updated_at = datetime('now') WHERE id = ?")
        .run(customerId, req.user!.id);
    }

    const url = await billing.createCheckout(
      customerId,
      `${origin}/dashboard?billing=success`,
      `${origin}/dashboard?billing=cancelled`
    );

    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /billing/usage — Current period usage
 */
billingRoutes.get("/usage", requireAuth, (req: AuthRequest, res: Response) => {
  const db = getDb();

  const bots = db
    .prepare("SELECT * FROM bots WHERE user_id = ? AND status = 'running'")
    .all(req.user!.id) as Record<string, unknown>[];

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const usage = db
    .prepare(
      `SELECT SUM(hours) as total_hours, SUM(cost_usd) as total_cost
       FROM usage_records ur JOIN bots b ON ur.bot_id = b.id
       WHERE b.user_id = ? AND ur.period_start >= ?`
    )
    .get(req.user!.id, startOfMonth.toISOString()) as { total_hours: number; total_cost: number } | undefined;

  const hourlyBurn = bots.reduce((sum, bot) => {
    return sum + (COST_PER_HOUR[(bot.instance_size as string) || "small"] || 0.12);
  }, 0);

  res.json({
    running_bots: bots.length,
    hourly_burn: hourlyBurn,
    this_month: { hours: usage?.total_hours || 0, cost: usage?.total_cost || 0 },
    estimated_monthly: hourlyBurn * 720,
  });
});

/**
 * GET /billing/portal — Stripe billing portal URL
 */
billingRoutes.get("/portal", requireAuth, async (req: AuthRequest, res: Response) => {
  if (!req.user!.stripe_customer_id) {
    res.status(400).json({ error: "No billing setup" });
    return;
  }

  const origin = req.headers.origin || "https://clawster.run";
  const url = await billing.getPortalUrl(req.user!.stripe_customer_id, `${origin}/dashboard`);
  res.json({ url });
});

/**
 * POST /billing/webhook — Stripe webhook (raw body)
 */
billingRoutes.post("/webhook", async (req: Request, res: Response) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
  });

  const sig = req.headers["stripe-signature"] as string;
  if (!sig) { res.status(400).json({ error: "Missing signature" }); return; }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch {
    res.status(400).json({ error: "Invalid signature" }); return;
  }

  switch (event.type) {
    case "customer.subscription.created":
      console.log("[stripe] Sub created:", (event.data.object as Stripe.Subscription).id);
      break;
    case "customer.subscription.deleted":
      console.log("[stripe] Sub deleted:", (event.data.object as Stripe.Subscription).id);
      // TODO: terminate user's bots after grace period
      break;
    case "invoice.payment_failed":
      console.log("[stripe] Payment failed:", (event.data.object as Stripe.Invoice).id);
      // TODO: notify user via Telegram
      break;
    case "invoice.paid":
      console.log("[stripe] Paid:", (event.data.object as Stripe.Invoice).id);
      break;
  }

  res.json({ received: true });
});
