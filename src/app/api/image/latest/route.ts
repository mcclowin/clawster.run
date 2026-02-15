import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    image: process.env.OPENCLAW_IMAGE || "ghcr.io/mcclowin/openclaw-tee:latest",
    updated: new Date().toISOString(),
  });
}
