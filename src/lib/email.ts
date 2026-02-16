/**
 * Email — Send magic codes via SMTP (Gmail, any provider)
 *
 * Uses nodemailer. Works with any SMTP server.
 * For Gmail: use an App Password (not your real password).
 */

import nodemailer from "nodemailer";

let _transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter | null {
  if (_transport) return _transport;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  _transport = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: { user, pass },
  });

  return _transport;
}

export async function sendCode(to: string, code: string): Promise<void> {
  const transport = getTransport();

  if (!transport) {
    // Dev fallback
    console.log(`\n🦞 Magic code for ${to}: ${code}\n`);
    return;
  }

  await transport.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `${code} — Your Clawster login code`,
    text: `Your Clawster login code is: ${code}\n\nExpires in 10 minutes.`,
    html: `
      <div style="font-family: monospace; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #e0e4f0; font-size: 18px;">🦞 Clawster</h2>
        <p style="color: #8890b0; font-size: 14px; margin: 20px 0;">Your login code:</p>
        <div style="background: #111520; border: 1px solid #1c2030; border-radius: 6px; padding: 24px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; letter-spacing: 8px; color: #f97316; font-weight: 700;">${code}</span>
        </div>
        <p style="color: #3a4060; font-size: 12px;">Expires in 10 minutes. If you didn't request this, ignore it.</p>
      </div>
    `,
  });
}
