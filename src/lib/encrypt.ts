/**
 * Client-side encryption for Phala TEE environment variables.
 *
 * Matches the Phala SDK's encryptEnvVars implementation:
 * - x25519 key exchange (ephemeral keypair + TEE pubkey)
 * - AES-256-GCM encryption
 * - Output: hex(ephemeral_pubkey | iv | ciphertext)
 */

import { x25519 } from "@noble/curves/ed25519.js";
import crypto from "crypto";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = clean.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [];
  return new Uint8Array(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Encrypt env vars for Phala TEE using x25519 + AES-GCM.
 * Format matches Phala SDK exactly.
 *
 * @param envVars - Array of {key, value} pairs
 * @param teePubkeyHex - TEE's x25519 public key (hex)
 * @returns hex string: ephemeral_pubkey(32) | iv(12) | ciphertext(variable)
 */
export async function encryptEnvVars(
  envVars: { key: string; value: string }[],
  teePubkeyHex: string
): Promise<string> {
  const plaintext = JSON.stringify({ env: envVars });

  // Generate ephemeral x25519 keypair
  const ephemeralPriv = x25519.utils.randomSecretKey();
  const ephemeralPub = x25519.getPublicKey(ephemeralPriv);

  // Derive shared secret
  const remotePub = hexToBytes(teePubkeyHex);
  const sharedSecret = x25519.getSharedSecret(ephemeralPriv, remotePub);

  // AES-256-GCM encrypt
  const aesKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(plaintext)
  );

  // Concatenate: ephemeral_pubkey | iv | ciphertext
  const result = new Uint8Array(
    ephemeralPub.length + iv.length + ciphertext.byteLength
  );
  result.set(ephemeralPub);
  result.set(iv, ephemeralPub.length);
  result.set(new Uint8Array(ciphertext), ephemeralPub.length + iv.length);

  return bytesToHex(result);
}
