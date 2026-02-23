import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { dbRun, dbGet, generateId } from "@/lib/db";
import * as phala from "@/lib/phala";
import * as billing from "@/lib/stripe";
import { deployBot } from "@/lib/deploy";

// ── Billing bypass for testing ──
const BYPASS_BILLING = process.env.BYPASS_BILLING === "true";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { name, model, size, telegram_token, api_key, owner_id, soul } = await req.json();

  // ── Validate ──
  if (!name || !/^[a-z0-9][a-z0-9-]{0,22}[a-z0-9]$/.test(name)) {
    return NextResponse.json({ error: "Bot name: 2-24 chars, lowercase alphanumeric + hyphens" }, { status: 400 });
  }
  if (!telegram_token) return NextResponse.json({ error: "Telegram bot token is required" }, { status: 400 });
  if (!api_key) return NextResponse.json({ error: "AI API key is required" }, { status: 400 });
  if (!owner_id) return NextResponse.json({ error: "Telegram owner ID is required" }, { status: 400 });

  const existing = await dbGet(
    "SELECT id, status FROM bots WHERE user_id = ? AND name = ?",
    user.id, name
  );
  if (existing) {
    if ((existing as any).status !== "terminated") {
      return NextResponse.json({ error: "Bot name already in use" }, { status: 409 });
    }
    await dbRun("DELETE FROM bots WHERE id = ?", (existing as any).id);
  }

  const botId = generateId();
  const instanceSize = ["small", "medium"].includes(size) ? size : "small";
  const botModel = model || "anthropic/claude-sonnet-4-20250514";

  // ── Save bot + secrets as pending ──
  await dbRun(
    `INSERT INTO bots (id, user_id, name, model, instance_size, status, pending_telegram_token, pending_api_key, pending_owner_id, pending_soul)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    botId, user.id, name, botModel, instanceSize,
    BYPASS_BILLING ? "provisioning" : "pending_payment",
    telegram_token, api_key, String(owner_id), soul || null
  );

  // ── BYPASS: skip billing, deploy directly ──
  if (BYPASS_BILLING) {
    const result = await deployBot(botId);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({
      bot_id: botId, name, status: "starting", ...result,
    }, { status: 201 });
  }

  // ── Create Stripe Checkout ──
  const origin = req.headers.get("origin") || "https://clawster.run";
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    customerId = await billing.ensureCustomer(user.id, user.email);
    await dbRun("UPDATE users SET stripe_customer_id = ?, updated_at = datetime('now') WHERE id = ?", customerId, user.id);
  }

  const sizeConfig = phala.getSize(instanceSize);
  const checkoutUrl = await billing.createBotCheckout(
    customerId,
    botId,
    instanceSize,
    sizeConfig.retailPerHour,
    `${origin}/dashboard?billing=success&bot=${botId}`,
    `${origin}/dashboard?billing=cancelled&bot=${botId}`
  );

  return NextResponse.json({
    bot_id: botId, name, status: "pending_payment", checkout_url: checkoutUrl,
  }, { status: 201 });
}
