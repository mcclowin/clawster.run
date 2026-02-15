/**
 * GET /api/billing/usage
 *
 * Get current billing period usage for the authenticated user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import * as phala from "@/lib/phala";
import { cookies } from "next/headers";

export async function GET(_req: NextRequest) {
  const user = await getAuthUser(await cookies());
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = getDb();

  // Get running bots
  const bots = db
    .prepare("SELECT * FROM bots WHERE user_id = ? AND status = 'running'")
    .all(user.id) as Record<string, unknown>[];

  // Get usage this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const usage = db
    .prepare(
      `SELECT SUM(hours) as total_hours, SUM(cost_usd) as total_cost
       FROM usage_records ur
       JOIN bots b ON ur.bot_id = b.id
       WHERE b.user_id = ? AND ur.period_start >= ?`
    )
    .get(user.id, startOfMonth.toISOString()) as { total_hours: number; total_cost: number } | undefined;

  // Calculate cost per hour per size
  const costPerHour: Record<string, number> = { small: 0.12, medium: 0.24 };

  // Current hourly burn rate
  const hourlyBurn = bots.reduce((sum, bot) => {
    return sum + (costPerHour[(bot.instance_size as string) || "small"] || 0.12);
  }, 0);

  return NextResponse.json({
    running_bots: bots.length,
    hourly_burn: hourlyBurn,
    this_month: {
      hours: usage?.total_hours || 0,
      cost: usage?.total_cost || 0,
    },
    estimated_monthly: hourlyBurn * 720, // 30 days
  });
}
