/**
 * POST /api/bots/spawn
 *
 * Provision a new bot CVM on Phala via our master account.
 * Does NOT receive any user secrets — those are encrypted
 * client-side and sent directly to the TEE after boot.
 *
 * Body: { name: string, model: string, size: "small" | "medium" }
 * Returns: { bot_id, status, tee_pubkey?, cvm_endpoint? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getDb, generateId } from "@/lib/db";
import * as phala from "@/lib/phala";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(await cookies());
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { name, model, size } = await req.json();

  // Validate
  if (!name || !/^[a-z0-9-]{2,24}$/.test(name)) {
    return NextResponse.json(
      { error: "Bot name must be 2-24 chars, lowercase alphanumeric + hyphens" },
      { status: 400 }
    );
  }

  if (!["small", "medium"].includes(size || "small")) {
    return NextResponse.json({ error: "Invalid size" }, { status: 400 });
  }

  const db = getDb();

  // Check for duplicate name
  const existing = db
    .prepare("SELECT id FROM bots WHERE user_id = ? AND name = ? AND status != 'terminated'")
    .get(user.id, name);

  if (existing) {
    return NextResponse.json({ error: "Bot name already in use" }, { status: 409 });
  }

  // Create bot record
  const botId = generateId();
  const instanceSize = size || "small";

  db.prepare(
    `INSERT INTO bots (id, user_id, name, model, instance_size, status)
     VALUES (?, ?, ?, ?, ?, 'provisioning')`
  ).run(botId, user.id, name, model || "anthropic/claude-sonnet-4-20250514", instanceSize);

  // Provision CVM on Phala
  try {
    const cvm = await phala.spawn(name, instanceSize);

    // Update bot record with Phala IDs
    db.prepare(
      `UPDATE bots SET phala_cvm_id = ?, phala_app_id = ?, status = 'provisioning', updated_at = datetime('now')
       WHERE id = ?`
    ).run(cvm.id, cvm.app_id, botId);

    return NextResponse.json({
      bot_id: botId,
      name,
      status: "provisioning",
      phala_cvm_id: cvm.id,
      // TEE pubkey and endpoint will be available once CVM is running
      // Client should poll GET /api/bots/{id}/status until ready
    });
  } catch (err) {
    // Mark as error
    db.prepare("UPDATE bots SET status = 'error', updated_at = datetime('now') WHERE id = ?").run(botId);

    return NextResponse.json(
      { error: "Failed to provision", detail: String(err) },
      { status: 502 }
    );
  }
}
