/**
 * Phala Cloud API Client — Clawster.run
 *
 * Two-phase deploy: provision (stores compose) → commit (starts CVM).
 * Env vars encrypted client-side to TEE pubkey — we never see plaintext secrets.
 *
 * API auth: X-API-Key header (NOT Authorization: Bearer).
 * Proven working format as of 2026-02-16.
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

export const SIZES = {
  small:  { vcpu: 1, memory: 2048, disk: 20, instanceType: "tdx.small",  costPerHour: 0.058, retailPerHour: 0.12 },
  medium: { vcpu: 2, memory: 4096, disk: 40, instanceType: "tdx.medium", costPerHour: 0.116, retailPerHour: 0.24 },
} as const;

export type SizeKey = keyof typeof SIZES;

export function getSize(size: string) {
  return SIZES[size as SizeKey] || SIZES.small;
}

// ── Compose file generation ──

function makeCompose(envVars: { key: string; value: string }[]): string {
  const image = process.env.OPENCLAW_IMAGE || "ghcr.io/mcclowin/openclaw-tee:latest";
  // Use ${VAR} placeholders — values are passed via encrypted_env (x25519 + AES-GCM)
  const envLines = envVars.map(e => `      - ${e.key}=\${${e.key}}`).join("\n");

  return `services:
  openclaw:
    image: ${image}
    environment:
${envLines}
    ports:
      - "3000:3000"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2048M`;
}

// ── Types ──

export interface ProvisionResult {
  app_id: string;
  app_env_encrypt_pubkey: string;
  compose_hash: string;
}

export interface CvmInfo {
  id: string;
  name: string;
  app_id: string;
  vm_uuid: string;
  status: string;
  resource: {
    instance_type: string;
    vcpu: number;
    memory_in_gb: number;
    disk_in_gb: number;
    compute_billing_price: string;
    billing_period: string;
  };
  endpoints: { app: string; instance: string }[];
  created_at: string;
  compose_file: {
    docker_compose_file: string | null;
  } | null;
}

export interface ContainerInfo {
  id: string;
  names: string[];
  image: string;
  state: string;
  status: string;
}

// ── Phase 1: Provision (stores compose, returns TEE pubkey) ──

export async function provision(
  name: string,
  size: SizeKey,
  envVars: { key: string; value: string }[]
): Promise<ProvisionResult> {
  const s = getSize(size);
  const compose = makeCompose(envVars);

  const res = await fetch(`${PHALA_API}/cvms/provision`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name,
      vcpu: s.vcpu,
      memory: s.memory,
      disk_size: s.disk,
      instance_type: s.instanceType,
      compose_file: {
        docker_compose_file: compose,
        allowed_envs: envVars.map(e => e.key),
        name: "",
        public_logs: true,
        public_sysinfo: true,
        gateway_enabled: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Phala provision failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    app_id: data.app_id,
    app_env_encrypt_pubkey: data.app_env_encrypt_pubkey,
    compose_hash: data.compose_hash,
  };
}

// ── Phase 2: Commit (starts CVM, optionally with encrypted env) ──

export async function commit(
  appId: string,
  composeHash: string,
  encryptedEnv?: string,
  envKeys?: string[]
): Promise<CvmInfo> {
  const body: Record<string, unknown> = {
    app_id: appId,
    compose_hash: composeHash,
  };

  if (encryptedEnv) {
    body.encrypted_env = encryptedEnv;
  }
  if (envKeys && envKeys.length > 0) {
    body.env_keys = envKeys;
  }

  const res = await fetch(`${PHALA_API}/cvms`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Phala commit failed (${res.status}): ${err}`);
  }

  return res.json();
}

// ── Full deploy (provision + encrypt + commit) ──

export async function spawn(
  name: string,
  size: SizeKey,
  envVars: { key: string; value: string }[]
): Promise<{ cvm: CvmInfo; teePubkey: string }> {
  const { encryptEnvVars } = await import("./encrypt");

  // Phase 1: provision — stores compose with ${VAR} placeholders, gets TEE pubkey
  const prov = await provision(name, size, envVars);

  // Phase 2: encrypt env vars to TEE pubkey (x25519 + AES-GCM)
  const encryptedEnv = await encryptEnvVars(envVars, prov.app_env_encrypt_pubkey);

  // Phase 3: commit — starts the CVM with encrypted secrets + env key names
  const envKeys = envVars.map(e => e.key);
  const cvm = await commit(prov.app_id, prov.compose_hash, encryptedEnv, envKeys);

  return { cvm, teePubkey: prov.app_env_encrypt_pubkey };
}

// ── Management ──

/** Get CVM status */
export async function getStatus(cvmId: string): Promise<CvmInfo> {
  const res = await fetch(`${PHALA_API}/cvms/${cvmId}`, { headers: headers() });
  if (!res.ok) throw new Error(`Phala status failed (${res.status})`);
  return res.json();
}

/** List containers in a CVM */
export async function getContainers(cvmId: string): Promise<ContainerInfo[]> {
  const res = await fetch(`${PHALA_API}/cvms/${cvmId}/containers`, { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.containers || data;
}

/** List all CVMs in our workspace */
export async function listCvms(): Promise<CvmInfo[]> {
  const res = await fetch(`${PHALA_API}/cvms`, { headers: headers() });
  if (!res.ok) throw new Error(`Phala list failed (${res.status})`);
  const data = await res.json();
  return data.items || data.data || data;
}

/** Restart a CVM */
export async function restart(cvmId: string): Promise<void> {
  const res = await fetch(`${PHALA_API}/cvms/${cvmId}/restart`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Phala restart failed (${res.status})`);
}

/** Delete/terminate a CVM */
export async function terminate(cvmId: string): Promise<void> {
  const res = await fetch(`${PHALA_API}/cvms/${cvmId}`, {
    method: "DELETE",
    headers: headers(),
  });
  // 204 = success, no content
  if (!res.ok && res.status !== 204) {
    throw new Error(`Phala delete failed (${res.status})`);
  }
}
