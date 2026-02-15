import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getDb, generateId } from "@/lib/db";
import * as phala from "@/lib/phala";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { name, model, size } = await req.json();

  if (!name || !/^[a-z0-9-]{2,24}$/.test(name)) {
    return NextResponse.json(
      { error: "Bot name: 2-24 chars, lowercase alphanumeric + hyphens" },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM bots WHERE user_id = ? AND name = ? AND status != 'terminated'")
    .get(user.id, name);

  if (existing) {
    return NextResponse.json({ error: "Bot name already in use" }, { status: 409 });
  }

  const botId = generateId();
  const instanceSize = ["small", "medium"].includes(size) ? size : "small";
  const botModel = model || "anthropic/claude-sonnet-4-20250514";

  db.prepare(
    `INSERT INTO bots (id, user_id, name, model, instance_size, status)
     VALUES (?, ?, ?, ?, ?, 'provisioning')`
  ).run(botId, user.id, name, botModel, instanceSize);

  try {
    const cvm = await phala.spawn(name, instanceSize);

    db.prepare(
      `UPDATE bots SET phala_cvm_id = ?, phala_app_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(cvm.id, cvm.app_id, botId);

    return NextResponse.json({ bot_id: botId, name, status: "provisioning", phala_cvm_id: cvm.id });
  } catch (err) {
    db.prepare("UPDATE bots SET status = 'error', updated_at = datetime('now') WHERE id = ?").run(botId);
    return NextResponse.json({ error: "Spawn failed", detail: String(err) }, { status: 502 });
  }
}
