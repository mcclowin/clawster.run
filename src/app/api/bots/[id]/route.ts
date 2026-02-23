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
    try {
      await phala.terminate(bot.phala_cvm_id as string);
    } catch (err: unknown) {
      // Only ignore 404 (already gone). Everything else = real failure.
      const status = (err as { message?: string })?.message?.match(/(\d{3})/)?.[1];
      if (status !== "404") {
        return NextResponse.json(
          { error: "Failed to terminate on Phala", detail: err instanceof Error ? err.message : String(err) },
          { status: 502 }
        );
      }
    }
  }

  // Only mark terminated AFTER Phala confirms deletion
  await dbRun("UPDATE bots SET status = 'terminated', terminated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", id);
  return NextResponse.json({ status: "terminated" });
}
