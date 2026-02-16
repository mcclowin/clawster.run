import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { dbRun, dbGet, generateId } from "@/lib/db";
import * as phala from "@/lib/phala";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { name, model, size } = await req.json();

  if (!name || !/^[a-z0-9-]{2,24}$/.test(name)) {
    return NextResponse.json({ error: "Bot name: 2-24 chars, lowercase alphanumeric + hyphens" }, { status: 400 });
  }

  const existing = await dbGet("SELECT id FROM bots WHERE user_id = ? AND name = ? AND status != 'terminated'", user.id, name);
  if (existing) return NextResponse.json({ error: "Bot name already in use" }, { status: 409 });

  const botId = generateId();
  const instanceSize = ["small", "medium"].includes(size) ? size : "small";
  const botModel = model || "anthropic/claude-sonnet-4-20250514";

  await dbRun(
    `INSERT INTO bots (id, user_id, name, model, instance_size, status) VALUES (?, ?, ?, ?, ?, 'provisioning')`,
    botId, user.id, name, botModel, instanceSize
  );

  try {
    const cvm = await phala.spawn(name, instanceSize);
    await dbRun("UPDATE bots SET phala_cvm_id = ?, phala_app_id = ?, updated_at = datetime('now') WHERE id = ?", cvm.id, cvm.app_id, botId);
    return NextResponse.json({ bot_id: botId, name, status: "provisioning", phala_cvm_id: cvm.id });
  } catch (err) {
    await dbRun("UPDATE bots SET status = 'error', updated_at = datetime('now') WHERE id = ?", botId);
    return NextResponse.json({ error: "Spawn failed", detail: String(err) }, { status: 502 });
  }
}
