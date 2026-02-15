import { Router } from "express";
import { verifyTelegramAuth, findOrCreateUser, createToken } from "../lib/auth.js";
import { requireAuth, AuthRequest } from "../middleware.js";

export const authRoutes = Router();

/**
 * POST /auth/telegram
 * Telegram Login Widget callback
 */
authRoutes.post("/telegram", async (req, res) => {
  try {
    const data = req.body;

    if (!verifyTelegramAuth(data)) {
      res.status(401).json({ error: "Invalid Telegram auth" });
      return;
    }

    const user = findOrCreateUser(String(data.id), data.username);
    const token = await createToken(user);

    res.cookie("clawster_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.telegram_username,
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /auth/me
 */
authRoutes.get("/me", requireAuth, (req: AuthRequest, res) => {
  res.json({
    user: {
      id: req.user!.id,
      telegram_id: req.user!.telegram_id,
      username: req.user!.telegram_username,
      has_billing: !!req.user!.stripe_customer_id,
    },
  });
});

/**
 * POST /auth/logout
 */
authRoutes.post("/logout", (_req, res) => {
  res.clearCookie("clawster_session");
  res.json({ ok: true });
});
