/**
 * Auth middleware — extracts user from JWT cookie or Authorization header
 */

import { Request, Response, NextFunction } from "express";
import { verifyToken } from "./lib/auth.js";
import { getDb } from "./lib/db.js";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    telegram_id: string;
    telegram_username: string | null;
    stripe_customer_id: string | null;
  };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token =
    req.cookies?.clawster_session ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  verifyToken(token).then((payload) => {
    if (!payload) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub) as AuthRequest["user"];

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    req.user = user;
    next();
  }).catch(() => {
    res.status(401).json({ error: "Auth error" });
  });
}
