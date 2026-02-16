/**
 * Phala Cloud API Client
 *
 * Provisions and manages CVMs (Confidential VMs) on Phala Cloud.
 * Uses our master API key — users never touch Phala directly.
 */

const PHALA_API = "https://cloud-api.phala.network/api/v1";

function headers(): HeadersInit {
  const key = process.env.PHALA_API_KEY;
  if (!key) throw new Error("PHALA_API_KEY not configured");
  return {
    "X-API-Key": key,
    "Content-Type": "application/json",
  };
}

// ── Instance sizing ──

const SIZES: Record<string, { vcpu: number; memory: number; disk: number; costPerHour: number }> = {
  small:  { vcpu: 1, memory: 2048, disk: 20, costPerHour: 0.058 },
  medium: { vcpu: 2, memory: 4096, disk: 40, costPerHour: 0.116 },
};

export function getSize(size: string) {
  return SIZES[size] || SIZES.small;
}

// ── Compose file generation ──

function makeCompose(botName: string, size: string): string {
  const image = process.env.OPENCLAW_IMAGE || "ghcr.io/mcclowin/openclaw-tee:latest";

  // Note: secrets (TELEGRAM_BOT_TOKEN, API keys) are NOT in the compose.
  // They're encrypted client-side and sent directly to the TEE after boot.
  // The entrypoint waits for a secrets payload on :3001/secrets before starting.
  return `version: "3"
services:
  openclaw:
    image: ${image}
    environment:
      - BOT_NAME=${botName}
      - CLAWSTER_MODE=waiting
    ports:
      - "3000:3000"
      - "3001:3001"
    restart: unless-stopped`;
}

// ── API Methods ──

export interface CvmInfo {
  id: string;
  app_id: string;
  status: string;
  endpoint?: string;
}

/** Provision a new CVM */
export async function spawn(botName: string, size: string): Promise<CvmInfo> {
  const s = getSize(size);
  const compose = makeCompose(botName, size);

  const res = await fetch(`${PHALA_API}/cvms`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name: `clawster-${botName}`,
      compose: { docker_compose_file: compose },
      vcpu: s.vcpu,
      memory: s.memory,
      disk_size: s.disk,
      instance_type: size === "medium" ? "tdx.medium" : "tdx.small",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Phala spawn failed: ${res.status} ${err}`);
  }

  return res.json();
}

/** Get CVM status */
export async function getStatus(cvmId: string): Promise<CvmInfo> {
  const res = await fetch(`${PHALA_API}/cvms/${cvmId}`, { headers: headers() });
  if (!res.ok) throw new Error(`Phala status failed: ${res.status}`);
  return res.json();
}

/** List all our CVMs */
export async function listCvms(): Promise<CvmInfo[]> {
  const res = await fetch(`${PHALA_API}/cvms`, { headers: headers() });
  if (!res.ok) throw new Error(`Phala list failed: ${res.status}`);
  const data = await res.json();
  return data.data || data;
}

/** Restart a CVM */
export async function restart(cvmId: string): Promise<void> {
  const res = await fetch(`${PHALA_API}/cvms/${cvmId}/restart`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Phala restart failed: ${res.status}`);
}

/** Delete a CVM */
export async function terminate(cvmId: string): Promise<void> {
  const res = await fetch(`${PHALA_API}/cvms/${cvmId}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Phala delete failed: ${res.status}`);
}

/** Get CVM events (closest thing to logs) */
export async function getEvents(cvmId: string): Promise<unknown[]> {
  const res = await fetch(`${PHALA_API}/cvms/${cvmId}/events`, { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || data;
}
