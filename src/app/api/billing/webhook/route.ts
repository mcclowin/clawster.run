import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { dbRun, dbGet } from "@/lib/db";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const botId = session.metadata?.clawster_bot_id;
      if (!botId) {
        console.log("[stripe] Checkout completed but no bot ID in metadata");
        break;
      }

      console.log("[stripe] Checkout completed for bot:", botId, "subscription:", session.subscription);

      // Save subscription ID on the bot
      const subscriptionId = typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription as Stripe.Subscription)?.id;

      if (subscriptionId) {
        await dbRun(
          "UPDATE bots SET stripe_subscription_id = ?, updated_at = datetime('now') WHERE id = ?",
          subscriptionId, botId
        );
      }

      // Check bot is still pending payment
      const bot = await dbGet<Record<string, unknown>>("SELECT * FROM bots WHERE id = ?", botId);
      if (!bot) {
        console.error("[stripe] Bot not found:", botId);
        break;
      }
      if (bot.status !== "pending_payment") {
        console.log("[stripe] Bot not pending_payment, skipping deploy. Status:", bot.status);
        break;
      }

      // Trigger deploy (async — don't block webhook response)
      const { deployBot } = await import("@/lib/deploy");
      deployBot(botId).then(result => {
        if (result.error) {
          console.error("[stripe] Deploy failed after payment:", botId, result.error);
          // TODO: notify user via email that deploy failed, offer retry
        } else {
          console.log("[stripe] Deploy started for bot:", botId);
        }
      }).catch(err => {
        console.error("[stripe] Deploy error:", botId, err);
      });

      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const botId = sub.metadata?.clawster_bot_id;
      console.log("[stripe] Subscription deleted:", sub.id, "bot:", botId);

      if (botId) {
        // Terminate the bot
        const bot = await dbGet<Record<string, unknown>>("SELECT * FROM bots WHERE id = ?", botId);
        if (bot && bot.phala_cvm_id && !["terminated", "terminating"].includes(bot.status as string)) {
          const phala = await import("@/lib/phala");
          try {
            await phala.terminate(bot.phala_cvm_id as string);
          } catch (e) {
            console.error("[stripe] Failed to terminate bot on sub cancel:", botId, e);
          }
          await dbRun(
            "UPDATE bots SET status = 'terminated', terminated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
            botId
          );
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log("[stripe] Payment failed:", invoice.id, "customer:", invoice.customer);
      // TODO: send Telegram notification to user, 48h grace period
      break;
    }

    case "invoice.paid": {
      console.log("[stripe] Invoice paid:", (event.data.object as Stripe.Invoice).id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
