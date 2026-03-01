import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { dbGet } from "@/lib/db";

const PHALA_API = "https://cloud-api.phala.network/api/v1";

function phalaHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-API-Key": process.env.PHALA_API_KEY || "",
    "X-Phala-Version": "2025-10-28",
  };
}

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
      docker_image: "ghcr.io/mcclowin/openclaw-tee:latest",
      description: "Verify independently that this bot runs unmodified code in a genuine TEE.",
    },
  };

  // Fetch live attestation from Phala API
  if (bot.phala_cvm_id && bot.status === "running") {
    try {
      const cvmId = bot.phala_cvm_id as string;
      const res = await fetch(`${PHALA_API}/cvms/${cvmId}/attestation`, {
        headers: phalaHeaders(),
      });

      if (res.ok) {
        const data = await res.json();

        // Extract certificates
        if (data.app_certificates && Array.isArray(data.app_certificates)) {
          attestation.certificates = data.app_certificates.map((cert: Record<string, unknown>) => ({
            subject: cert.subject,
            issuer: cert.issuer,
            serial_number: cert.serial_number,
            not_before: cert.not_before,
            not_after: cert.not_after,
            fingerprint: cert.fingerprint,
            signature_algorithm: cert.signature_algorithm,
            is_ca: cert.is_ca,
            // Don't expose raw quote in JSON — too large
            has_quote: !!cert.quote,
          }));
        }

        // Extract TCB measurements
        if (data.tcb_info) {
          attestation.tcb_info = {
            mrtd: data.tcb_info.mrtd,
            rootfs_hash: data.tcb_info.rootfs_hash,
            rtmr0: data.tcb_info.rtmr0,
            rtmr1: data.tcb_info.rtmr1,
            rtmr2: data.tcb_info.rtmr2,
            rtmr3: data.tcb_info.rtmr3,
            event_log_count: data.tcb_info.event_log?.length || 0,
          };

          // Include compose hash from event log if available
          if (data.tcb_info.app_compose) {
            attestation.compose_hash = data.tcb_info.app_compose;
          }
        }

        attestation.is_online = data.is_online;
      }
    } catch (err) {
      console.error("[attestation] Error fetching from Phala:", err);
    }
  }

  return NextResponse.json(attestation);
}
