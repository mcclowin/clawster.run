/**
 * POST /api/bots/:id/restart
 *
 * Restart a bot's CVM on Phala.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import * as phala from "@/lib/phala";
import { cookies } from "next/headers";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(await cookies());
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const bot = db
    .prepare("SELECT * FROM bots WHERE id = ? AND user_id = ?")
    .get(id, user.id) as Record<string, unknown> | undefined;

  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  if (!bot.phala_cvm_id) return NextResponse.json({ error: "No CVM to restart" }, { status: 400 });

  await phala.restart(bot.phala_cvm_id as string);
  db.prepare("UPDATE bots SET status = 'provisioning', updated_at = datetime('now') WHERE id = ?").run(id);

  return NextResponse.json({ status: "restarting" });
}
