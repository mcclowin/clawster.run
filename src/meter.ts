/**
 * Meter Worker — runs every hour via Railway cron
 *
 * 1. Find all running bots
 * 2. Verify they're actually running on Phala
 * 3. Report 1 bot-hour to Stripe for each
 * 4. Log usage record to DB
 *
 * Railway cron: `npm run meter` scheduled every hour
 */

import { getDb, generateId } from "./lib/db.js";
import * as phala from "./lib/phala.js";
import * as stripe from "./lib/stripe.js";

const COST_PER_HOUR: Record<string, number> = { small: 0.12, medium: 0.24 };

async function run() {
  console.log("[meter] Starting usage metering...");

  const db = getDb();
  const now = new Date().toISOString();
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

  // Get all running bots with their user's Stripe info
  const bots = db
    .prepare(
      `SELECT b.*, u.stripe_customer_id
       FROM bots b JOIN users u ON b.user_id = u.id
       WHERE b.status = 'running' AND b.phala_cvm_id IS NOT NULL`
    )
    .all() as Record<string, unknown>[];

  console.log(`[meter] Found ${bots.length} running bots`);

  for (const bot of bots) {
    try {
      // Verify still running on Phala
      const cvm = await phala.getStatus(bot.phala_cvm_id as string);

      if (cvm.status !== "running") {
        console.log(`[meter] ${bot.name} is ${cvm.status}, updating status`);
        db.prepare("UPDATE bots SET status = ?, updated_at = datetime('now') WHERE id = ?")
          .run(cvm.status === "stopped" ? "stopped" : "error", bot.id);
        continue;
      }

      // Calculate cost
      const size = (bot.instance_size as string) || "small";
      const cost = COST_PER_HOUR[size] || 0.12;

      // Record usage
      db.prepare(
        `INSERT INTO usage_records (id, bot_id, period_start, period_end, hours, cost_usd)
         VALUES (?, ?, ?, ?, 1, ?)`
      ).run(generateId(), bot.id, oneHourAgo, now, cost);

      // Report to Stripe if user has subscription
      // TODO: look up subscription item ID for the user
      // For now, just log
      console.log(`[meter] ✓ ${bot.name}: 1hr @ $${cost}`);

    } catch (err) {
      console.error(`[meter] Error metering ${bot.name}:`, err);
    }
  }

  console.log("[meter] Done.");
  process.exit(0);
}

run();
