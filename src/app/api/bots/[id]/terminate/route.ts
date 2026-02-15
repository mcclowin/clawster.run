/**
 * DELETE /api/bots/:id/terminate
 *
 * Terminate a bot — deletes CVM on Phala, marks as terminated.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import * as phala from "@/lib/phala";
import { cookies } from "next/headers";

export async function DELETE(
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

  // Delete CVM on Phala
  if (bot.phala_cvm_id) {
    try {
      await phala.terminate(bot.phala_cvm_id as string);
    } catch {
      // CVM might already be gone
    }
  }

  // Mark as terminated
  db.prepare(
    "UPDATE bots SET status = 'terminated', terminated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(id);

  return NextResponse.json({ status: "terminated" });
}
