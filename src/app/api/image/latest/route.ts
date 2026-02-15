/**
 * GET /api/image/latest
 *
 * Returns the current Docker image tag for OpenClaw TEE deployments.
 * Clients use this to know which version to deploy.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    image: process.env.OPENCLAW_IMAGE || "ghcr.io/mcclowin/openclaw-tee:latest",
    updated: new Date().toISOString(),
  });
}
