import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware.js";
import { getDb, generateId } from "../lib/db.js";
import * as phala from "../lib/phala.js";

export const botRoutes = Router();

// All bot routes require auth
botRoutes.use(requireAuth);

/**
 * GET /bots — List user's bots
 */
botRoutes.get("/", (req: AuthRequest, res) => {
  const db = getDb();
  const bots = db
    .prepare(
      `SELECT id, name, status, model, instance_size, cvm_endpoint, created_at, updated_at
       FROM bots WHERE user_id = ? AND status != 'terminated'
       ORDER BY created_at DESC`
    )
    .all(req.user!.id);

  res.json({ bots });
});

/**
 * POST /bots/spawn — Provision new bot
 */
botRoutes.post("/spawn", async (req: AuthRequest, res) => {
  try {
    const { name, model, size } = req.body;

    if (!name || !/^[a-z0-9-]{2,24}$/.test(name)) {
      res.status(400).json({ error: "Bot name: 2-24 chars, lowercase alphanumeric + hyphens" });
      return;
    }

    const db = getDb();

    // Check duplicate
    const existing = db
      .prepare("SELECT id FROM bots WHERE user_id = ? AND name = ? AND status != 'terminated'")
      .get(req.user!.id, name);

    if (existing) {
      res.status(409).json({ error: "Bot name already in use" });
      return;
    }

    const botId = generateId();
    const instanceSize = ["small", "medium"].includes(size) ? size : "small";
    const botModel = model || "anthropic/claude-sonnet-4-20250514";

    db.prepare(
      `INSERT INTO bots (id, user_id, name, model, instance_size, status)
       VALUES (?, ?, ?, ?, ?, 'provisioning')`
    ).run(botId, req.user!.id, name, botModel, instanceSize);

    // Provision on Phala
    const cvm = await phala.spawn(name, instanceSize);

    db.prepare(
      `UPDATE bots SET phala_cvm_id = ?, phala_app_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(cvm.id, cvm.app_id, botId);

    res.json({
      bot_id: botId,
      name,
      status: "provisioning",
      phala_cvm_id: cvm.id,
    });
  } catch (err) {
    res.status(502).json({ error: "Spawn failed", detail: String(err) });
  }
});

/**
 * GET /bots/:id/status — Live status (polls Phala)
 */
botRoutes.get("/:id/status", async (req: AuthRequest, res) => {
  const db = getDb();
  const bot = db
    .prepare("SELECT * FROM bots WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

  if (!bot) { res.status(404).json({ error: "Not found" }); return; }

  // Poll Phala if active
  if (bot.phala_cvm_id && ["provisioning", "running"].includes(bot.status as string)) {
    try {
      const cvm = await phala.getStatus(bot.phala_cvm_id as string);
      let newStatus = bot.status as string;
      if (cvm.status === "running") newStatus = "running";
      else if (["stopped", "error"].includes(cvm.status)) newStatus = "error";

      if (newStatus !== bot.status) {
        db.prepare("UPDATE bots SET status = ?, updated_at = datetime('now') WHERE id = ?")
          .run(newStatus, req.params.id);
        bot.status = newStatus;
      }
      if (cvm.endpoint) {
        db.prepare("UPDATE bots SET cvm_endpoint = ?, updated_at = datetime('now') WHERE id = ?")
          .run(cvm.endpoint, req.params.id);
        bot.cvm_endpoint = cvm.endpoint;
      }
    } catch { /* use cached */ }
  }

  res.json({
    id: bot.id, name: bot.name, status: bot.status, model: bot.model,
    instance_size: bot.instance_size, cvm_endpoint: bot.cvm_endpoint,
    tee_pubkey: bot.tee_pubkey, created_at: bot.created_at,
  });
});

/**
 * POST /bots/:id/restart
 */
botRoutes.post("/:id/restart", async (req: AuthRequest, res) => {
  const db = getDb();
  const bot = db
    .prepare("SELECT * FROM bots WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

  if (!bot) { res.status(404).json({ error: "Not found" }); return; }
  if (!bot.phala_cvm_id) { res.status(400).json({ error: "No CVM" }); return; }

  await phala.restart(bot.phala_cvm_id as string);
  db.prepare("UPDATE bots SET status = 'provisioning', updated_at = datetime('now') WHERE id = ?")
    .run(req.params.id);

  res.json({ status: "restarting" });
});

/**
 * DELETE /bots/:id — Terminate
 */
botRoutes.delete("/:id", async (req: AuthRequest, res) => {
  const db = getDb();
  const bot = db
    .prepare("SELECT * FROM bots WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

  if (!bot) { res.status(404).json({ error: "Not found" }); return; }

  if (bot.phala_cvm_id) {
    try { await phala.terminate(bot.phala_cvm_id as string); } catch { /* already gone */ }
  }

  db.prepare(
    "UPDATE bots SET status = 'terminated', terminated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(req.params.id);

  res.json({ status: "terminated" });
});
