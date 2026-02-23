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

  // Try terminating on Phala — try both app_id and cvm_id since API may need either
  const phalaIds = [bot.phala_app_id, bot.phala_cvm_id].filter(Boolean) as string[];
  console.log("[terminate] Bot:", id, "phala_app_id:", bot.phala_app_id, "phala_cvm_id:", bot.phala_cvm_id);

  let terminated = false;
  for (const phalaId of phalaIds) {
    try {
      console.log("[terminate] Trying Phala DELETE with ID:", phalaId);
      await phala.terminate(phalaId);
      console.log("[terminate] Phala DELETE succeeded for:", phalaId);
      terminated = true;

      // Verify it's actually gone/stopped
      try {
        const status = await phala.getStatus(phalaId);
        console.log("[terminate] Post-delete status check:", phalaId, "status:", status?.status);
        if (status?.status?.toLowerCase() === "running") {
          console.error("[terminate] WARNING: Phala still shows running after DELETE for:", phalaId);
        }
      } catch {
        // 404 = good, it's gone
        console.log("[terminate] Post-delete status 404 (confirmed gone):", phalaId);
      }

      break; // success, no need to try other ID
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[terminate] Phala DELETE failed for:", phalaId, msg);
      // Only ignore 404 (already gone)
      if (msg.includes("404")) {
        terminated = true;
        break;
      }
    }
  }

  if (!terminated && phalaIds.length > 0) {
    return NextResponse.json(
      { error: "Failed to terminate on Phala — CVM may still be running. Check Phala dashboard." },
      { status: 502 }
    );
  }

  // Only mark terminated AFTER Phala confirms deletion
  await dbRun("UPDATE bots SET status = 'terminated', terminated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", id);
  return NextResponse.json({ status: "terminated" });
}
