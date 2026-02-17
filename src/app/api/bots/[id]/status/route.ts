import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { dbGet, dbRun } from "@/lib/db";
import * as phala from "@/lib/phala";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const bot = await dbGet<Record<string, unknown>>("SELECT * FROM bots WHERE id = ? AND user_id = ?", id, user.id);
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (bot.phala_cvm_id && ["provisioning", "running"].includes(bot.status as string)) {
    try {
      const cvm = await phala.getStatus(bot.phala_cvm_id as string);
      let newStatus = bot.status as string;
      if (cvm.status === "running") newStatus = "running";
      else if (["stopped", "error"].includes(cvm.status)) newStatus = "error";

      if (newStatus !== bot.status) {
        await dbRun("UPDATE bots SET status = ?, updated_at = datetime('now') WHERE id = ?", newStatus, id);
        bot.status = newStatus;
      }
      if (cvm.endpoints && cvm.endpoints.length > 0) {
        const ep = cvm.endpoints[0].app || cvm.endpoints[0].instance;
        await dbRun("UPDATE bots SET cvm_endpoint = ?, updated_at = datetime('now') WHERE id = ?", ep, id);
        bot.cvm_endpoint = ep;
      }
    } catch { /* cached */ }
  }

  return NextResponse.json({
    id: bot.id, name: bot.name, status: bot.status, model: bot.model,
    instance_size: bot.instance_size, cvm_endpoint: bot.cvm_endpoint,
    tee_pubkey: bot.tee_pubkey, created_at: bot.created_at,
  });
}
