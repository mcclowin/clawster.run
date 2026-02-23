/**
 * Bot deployment logic — shared between spawn route and webhook
 */

import { dbRun, dbGet } from "@/lib/db";
import * as phala from "@/lib/phala";

export async function deployBot(botId: string): Promise<{ error?: string; phala_app_id?: string; phala_cvm_id?: string }> {
  const bot = await dbGet<Record<string, unknown>>("SELECT * FROM bots WHERE id = ?", botId);
  if (!bot) return { error: "Bot not found" };

  const envVars: { key: string; value: string }[] = [
    { key: "TELEGRAM_BOT_TOKEN", value: bot.pending_telegram_token as string },
    { key: "ANTHROPIC_API_KEY", value: bot.pending_api_key as string },
    { key: "TELEGRAM_OWNER_ID", value: bot.pending_owner_id as string },
    { key: "DEFAULT_MODEL", value: bot.model as string },
    { key: "NODE_OPTIONS", value: "--max-old-space-size=1536" },
  ];
  if (bot.pending_soul) {
    envVars.push({ key: "SOUL_MD", value: bot.pending_soul as string });
  }

  let cvmId: string | undefined;
  let appId: string | undefined;

  try {
    await dbRun("UPDATE bots SET status = 'provisioning', updated_at = datetime('now') WHERE id = ?", botId);

    const { cvm, teePubkey } = await phala.spawn(
      bot.name as string,
      (bot.instance_size as phala.SizeKey) || "small",
      envVars
    );

    cvmId = cvm.vm_uuid || cvm.id;
    appId = cvm.app_id || "";

    // Save CVM info + clear pending secrets (they're now in the TEE)
    await dbRun(
      `UPDATE bots SET
        phala_app_id = ?, phala_cvm_id = ?, tee_pubkey = ?, status = 'starting',
        pending_telegram_token = NULL, pending_api_key = NULL, pending_owner_id = NULL, pending_soul = NULL,
        updated_at = datetime('now')
       WHERE id = ?`,
      appId, cvmId, teePubkey, botId
    );

    return { phala_app_id: appId, phala_cvm_id: cvmId };

  } catch (err) {
    console.error("[deployBot] Failed:", err);

    if (cvmId) {
      console.error("[deployBot] Cleaning up orphaned CVM:", cvmId);
      try { await phala.terminate(cvmId); } catch (e) {
        console.error("[deployBot] Orphan cleanup failed:", cvmId, e);
      }
    }

    await dbRun(
      "UPDATE bots SET status = 'error', phala_cvm_id = ?, updated_at = datetime('now') WHERE id = ?",
      cvmId || null, botId
    );
    return { error: String(err) };
  }
}
