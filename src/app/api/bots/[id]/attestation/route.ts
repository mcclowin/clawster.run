import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { dbGet } from "@/lib/db";
import * as phala from "@/lib/phala";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const bot = await dbGet<Record<string, unknown>>("SELECT * FROM bots WHERE id = ? AND user_id = ?", id, user.id);
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attestation: Record<string, unknown> = {
    bot_id: id,
    bot_name: bot.name,
    tee_platform: "Intel TDX (via Phala Network / dstack)",
    encryption: {
      algorithm: "x25519 + AES-256-GCM",
      tee_pubkey: bot.tee_pubkey || null,
      description: "Secrets encrypted client-side to TEE public key. Clawster never sees plaintext.",
    },
    phala: {
      app_id: bot.phala_app_id || null,
      cvm_id: bot.phala_cvm_id || null,
      cvm_endpoint: bot.cvm_endpoint || null,
    },
    verification: {
      trust_center: bot.phala_app_id
        ? `https://trust.phala.com/verify/${bot.phala_app_id}`
        : null,
      docker_image: "ghcr.io/mcclowin/openclaw-tee:latest",
      description: "Verify independently that this bot runs unmodified code in a genuine TEE.",
    },
  };

  // Fetch live attestation from Phala if CVM is running
  if (bot.phala_cvm_id && bot.status === "running") {
    const phalaAttestation = await phala.getAttestation(bot.phala_cvm_id as string);
    if (phalaAttestation) {
      attestation.tee_quote = phalaAttestation;
    }

    // Also try to get attestation from the CVM endpoint directly
    // dstack exposes /prpc/Attestation.GetReport at the CVM endpoint
    if (bot.cvm_endpoint) {
      try {
        const endpoint = (bot.cvm_endpoint as string).replace(/\/$/, "");
        const res = await fetch(`${endpoint}/attestation`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          attestation.live_attestation = await res.json();
        }
      } catch { /* endpoint not reachable or no attestation path */ }
    }
  }

  return NextResponse.json(attestation);
}
