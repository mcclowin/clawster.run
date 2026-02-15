/**
 * Clawster API Server
 *
 * Express backend for clawster.run
 * Deploy on Railway. Frontend on Netlify.
 *
 * Routes:
 *   POST /auth/telegram     — Telegram Login callback
 *   GET  /auth/me           — Current user
 *   POST /bots/spawn        — Provision new bot
 *   GET  /bots              — List user's bots
 *   GET  /bots/:id/status   — Bot status (polls Phala)
 *   POST /bots/:id/restart  — Restart bot
 *   DELETE /bots/:id        — Terminate bot
 *   POST /billing/checkout  — Stripe checkout session
 *   POST /billing/webhook   — Stripe webhook
 *   GET  /billing/usage     — Current usage + cost
 *   GET  /image/latest      — Docker image tag
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { authRoutes } from "./routes/auth.js";
import { botRoutes } from "./routes/bots.js";
import { billingRoutes } from "./routes/billing.js";
import { imageRoutes } from "./routes/image.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3100");

// ── Middleware ──
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "https://clawster.run",
  credentials: true,
}));
app.use(cookieParser());

// Stripe webhook needs raw body
app.use("/billing/webhook", express.raw({ type: "application/json" }));
// Everything else gets JSON parsing
app.use(express.json());

// ── Routes ──
app.use("/auth", authRoutes);
app.use("/bots", botRoutes);
app.use("/billing", billingRoutes);
app.use("/image", imageRoutes);

// ── Health ──
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "clawster", version: "0.1.0" });
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`🦞 Clawster API listening on :${PORT}`);
});

export default app;
