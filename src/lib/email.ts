/**
 * Auth via Stytch — Email OTP (one-time passcode)
 *
 * Stytch handles email delivery. We just call their API.
 * Free: 5,000 MAU
 */

import * as stytch from "stytch";

let _client: stytch.Client | null = null;

function getClient(): stytch.Client {
  if (_client) return _client;

  const projectId = process.env.STYTCH_PROJECT_ID;
  const secret = process.env.STYTCH_SECRET;

  if (!projectId || !secret) throw new Error("STYTCH_PROJECT_ID and STYTCH_SECRET required");

  _client = new stytch.Client({
    project_id: projectId,
    secret,
    env: projectId.includes("live") ? stytch.envs.live : stytch.envs.test,
  });

  return _client;
}

/** Send OTP code to email (Stytch sends the email) */
export async function sendOtp(email: string): Promise<{ methodId: string }> {
  const client = getClient();

  const res = await client.otps.email.loginOrCreate({
    email,
    expiration_minutes: 10,
  });

  return { methodId: res.email_id };
}

/** Verify OTP code */
export async function verifyOtp(methodId: string, code: string): Promise<{ email: string; userId: string }> {
  const client = getClient();

  const res = await client.otps.authenticate({
    method_id: methodId,
    code,
  });

  const email = res.user.emails?.[0]?.email;
  if (!email) throw new Error("No email in Stytch response");

  return { email, userId: res.user_id };
}
