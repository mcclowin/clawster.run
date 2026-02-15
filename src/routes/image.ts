import { Router } from "express";

export const imageRoutes = Router();

/**
 * GET /image/latest — Current Docker image tag
 */
imageRoutes.get("/latest", (_req, res) => {
  res.json({
    image: process.env.OPENCLAW_IMAGE || "ghcr.io/mcclowin/openclaw-tee:latest",
    updated: new Date().toISOString(),
  });
});
