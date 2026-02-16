import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { dbGet, dbRun } from "@/lib/db";
import * as phala from "@/lib/phala";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const bot = await dbGet<Record<string, unknown>>("SELECT * FROM bots WHERE id = ? AND user_id = ?", id, user.id);
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (bot.phala_cvm_id) {
    try { await phala.terminate(bot.phala_cvm_id as string); } catch { /* gone */ }
  }

  await dbRun("UPDATE bots SET status = 'terminated', terminated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", id);
  return NextResponse.json({ status: "terminated" });
}
