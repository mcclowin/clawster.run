import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { dbGet } from "@/lib/db";
import * as phala from "@/lib/phala";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const bot = await dbGet<Record<string, unknown>>("SELECT * FROM bots WHERE id = ? AND user_id = ?", id, user.id);
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!bot.phala_cvm_id) return NextResponse.json({ error: "No CVM" }, { status: 400 });

  const tail = parseInt(req.nextUrl.searchParams.get("tail") || "100");

  const logs = await phala.getLogs(bot.phala_cvm_id as string, Math.min(tail, 500));

  // Filter out lines that might contain secrets (extra safety)
  const filtered = logs
    .split("\n")
    .filter(line => {
      const lower = line.toLowerCase();
      return !lower.includes("api_key=") &&
             !lower.includes("bot_token=") &&
             !lower.includes("sk-ant-") &&
             !lower.includes("sk-") &&
             !lower.includes("token=");
    })
    .join("\n");

  return NextResponse.json({ logs: filtered, line_count: filtered.split("\n").length });
}
