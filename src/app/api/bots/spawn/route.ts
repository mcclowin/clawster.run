import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { dbRun, dbGet, generateId } from "@/lib/db";
import * as phala from "@/lib/phala";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { name, model, size, telegram_token, api_key, owner_id, soul } = await req.json();

  // ── Validate ──
  if (!name || !/^[a-z0-9][a-z0-9-]{0,22}[a-z0-9]$/.test(name)) {
    return NextResponse.json({ error: "Bot name: 2-24 chars, lowercase alphanumeric + hyphens" }, { status: 400 });
  }
  if (!telegram_token) {
    return NextResponse.json({ error: "Telegram bot token is required" }, { status: 400 });
  }
  if (!api_key) {
    return NextResponse.json({ error: "AI API key is required" }, { status: 400 });
  }
  if (!owner_id) {
    return NextResponse.json({ error: "Telegram owner ID is required" }, { status: 400 });
  }

  const existing = await dbGet(
    "SELECT id, status FROM bots WHERE user_id = ? AND name = ?",
    user.id, name
  );
  if (existing) {
    if ((existing as any).status !== 'terminated') {
      return NextResponse.json({ error: "Bot name already in use" }, { status: 409 });
    }
    // Remove old terminated record so we can reuse the name
    await dbRun("DELETE FROM bots WHERE id = ?", (existing as any).id);
  }

  const botId = generateId();
  const instanceSize = ["small", "medium"].includes(size) ? size : "small";
  const botModel = model || "anthropic/claude-sonnet-4-20250514";

  // ── Insert bot record ──
  await dbRun(
    `INSERT INTO bots (id, user_id, name, model, instance_size, status) VALUES (?, ?, ?, ?, ?, 'provisioning')`,
    botId, user.id, name, botModel, instanceSize
  );

  // ── Build env vars for the TEE container ──
  const envVars: { key: string; value: string }[] = [
    { key: "TELEGRAM_BOT_TOKEN", value: telegram_token },
    { key: "ANTHROPIC_API_KEY", value: api_key },
    { key: "TELEGRAM_OWNER_ID", value: String(owner_id) },
    { key: "DEFAULT_MODEL", value: botModel },
    { key: "NODE_OPTIONS", value: "--max-old-space-size=1536" },
  ];
  if (soul) {
    envVars.push({ key: "SOUL_MD", value: soul });
  }

  try {
    // Deploy: provision → encrypt to TEE pubkey → commit (all in one call)
    const { cvm, teePubkey } = await phala.spawn(
      name,
      instanceSize as phala.SizeKey,
      envVars
    );

    // Update bot record with CVM info
    const cvmId = cvm.vm_uuid || cvm.id;
    const appId = cvm.app_id || "";
    await dbRun(
      "UPDATE bots SET phala_app_id = ?, phala_cvm_id = ?, tee_pubkey = ?, status = 'starting', updated_at = datetime('now') WHERE id = ?",
      appId, cvmId, teePubkey, botId
    );

    return NextResponse.json({
      bot_id: botId,
      name,
      status: "starting",
      phala_app_id: appId,
      phala_cvm_id: cvmId,
      tee_pubkey: teePubkey,
    }, { status: 201 });

  } catch (err) {
    console.error("[spawn] Phala deploy failed:", err);
    await dbRun(
      "UPDATE bots SET status = 'error', updated_at = datetime('now') WHERE id = ?",
      botId
    );
    return NextResponse.json(
      { error: "Spawn failed", detail: String(err) },
      { status: 502 }
    );
  }
}
