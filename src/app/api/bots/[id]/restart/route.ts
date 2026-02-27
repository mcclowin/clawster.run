import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { dbGet, dbRun } from "@/lib/db";
import * as phala from "@/lib/phala";
import { deployBot } from "@/lib/deploy";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const bot = await dbGet<Record<string, unknown>>("SELECT * FROM bots WHERE id = ? AND user_id = ?", id, user.id);
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (bot.status === "terminated") return NextResponse.json({ error: "Bot is terminated" }, { status: 400 });
  if (bot.status === "provisioning" || bot.status === "starting") {
    return NextResponse.json({ error: "Bot is already starting" }, { status: 409 });
  }

  // If bot has no CVM (failed spawn), re-deploy from scratch
  if (!bot.phala_cvm_id) {
    if (bot.status !== "error") {
      return NextResponse.json({ error: "Bot has no CVM and is not in error state" }, { status: 400 });
    }
    try {
      const result = await deployBot(id);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }
      return NextResponse.json({ status: "respawning" });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 502 });
    }
  }

  try {
    // Verify CVM still exists on Phala before restarting
    try {
      await phala.getStatus(bot.phala_cvm_id as string);
    } catch {
      // CVM gone — re-deploy from scratch
      try {
        const result = await deployBot(id);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 502 });
        }
        return NextResponse.json({ status: "respawning" });
      } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 502 });
      }
    }

    await phala.restart(bot.phala_cvm_id as string);
    await dbRun("UPDATE bots SET status = 'provisioning', updated_at = datetime('now') WHERE id = ?", id);
    return NextResponse.json({ status: "restarting" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
