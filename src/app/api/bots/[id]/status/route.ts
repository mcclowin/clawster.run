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

  // Always sync with Phala if we have a CVM ID and bot isn't terminated
  if (bot.phala_cvm_id && bot.status !== "terminated") {
    try {
      const cvm = await phala.getStatus(bot.phala_cvm_id as string);
      const phalaStatus = cvm.status?.toLowerCase() || "unknown";

      // Map Phala status → Clawster status
      let newStatus = bot.status as string;
      if (phalaStatus === "running") newStatus = "running";
      else if (phalaStatus === "starting" || phalaStatus === "creating") newStatus = "provisioning";
      else if (phalaStatus === "stopped" || phalaStatus === "exited") newStatus = "stopped";
      else if (phalaStatus === "error" || phalaStatus === "failed") newStatus = "error";

      if (newStatus !== bot.status) {
        await dbRun("UPDATE bots SET status = ?, updated_at = datetime('now') WHERE id = ?", newStatus, id);
        bot.status = newStatus;
      }

      // Store endpoint if available
      if (cvm.endpoints && cvm.endpoints.length > 0) {
        const ep = cvm.endpoints[0].app || cvm.endpoints[0].instance;
        if (ep && ep !== bot.cvm_endpoint) {
          await dbRun("UPDATE bots SET cvm_endpoint = ?, updated_at = datetime('now') WHERE id = ?", ep, id);
          bot.cvm_endpoint = ep;
        }
      }

      // Pass through raw Phala status for debugging
      (bot as any).phala_status = phalaStatus;
    } catch (err: unknown) {
      // If Phala returns 404, the CVM is gone
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404")) {
        await dbRun("UPDATE bots SET status = 'stopped', updated_at = datetime('now') WHERE id = ?", id);
        bot.status = "stopped";
        (bot as any).phala_status = "not_found";
      }
    }
  }

  return NextResponse.json({
    id: bot.id, name: bot.name, status: bot.status, model: bot.model,
    instance_size: bot.instance_size, cvm_endpoint: bot.cvm_endpoint,
    phala_app_id: bot.phala_app_id, phala_cvm_id: bot.phala_cvm_id,
    phala_status: (bot as any).phala_status || null,
    tee_pubkey: bot.tee_pubkey, created_at: bot.created_at,
  });
}
