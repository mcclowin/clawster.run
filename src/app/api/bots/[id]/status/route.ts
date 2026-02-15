/**
 * GET /api/bots/:id/status
 *
 * Get bot status. Polls Phala if bot is provisioning/running.
 * Returns TEE pubkey and endpoint once CVM is ready.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import * as phala from "@/lib/phala";
import { cookies } from "next/headers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(await cookies());
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();
  const bot = db
    .prepare("SELECT * FROM bots WHERE id = ? AND user_id = ?")
    .get(id, user.id) as Record<string, unknown> | undefined;

  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  // If bot has a CVM, poll Phala for live status
  if (bot.phala_cvm_id && ["provisioning", "running"].includes(bot.status as string)) {
    try {
      const cvm = await phala.getStatus(bot.phala_cvm_id as string);

      let newStatus = bot.status as string;
      if (cvm.status === "running") newStatus = "running";
      else if (cvm.status === "stopped" || cvm.status === "error") newStatus = "error";

      // Update if changed
      if (newStatus !== bot.status) {
        db.prepare("UPDATE bots SET status = ?, updated_at = datetime('now') WHERE id = ?")
          .run(newStatus, id);
        bot.status = newStatus;
      }

      // If running, extract endpoint info
      if (cvm.status === "running" && cvm.endpoint) {
        db.prepare("UPDATE bots SET cvm_endpoint = ?, updated_at = datetime('now') WHERE id = ?")
          .run(cvm.endpoint, id);
        bot.cvm_endpoint = cvm.endpoint;
      }
    } catch {
      // Phala unavailable — return cached status
    }
  }

  return NextResponse.json({
    id: bot.id,
    name: bot.name,
    status: bot.status,
    model: bot.model,
    instance_size: bot.instance_size,
    cvm_endpoint: bot.cvm_endpoint,
    tee_pubkey: bot.tee_pubkey,
    created_at: bot.created_at,
    updated_at: bot.updated_at,
  });
}
