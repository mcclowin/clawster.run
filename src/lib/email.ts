/**
 * Email — Send magic codes via Resend or SMTP
 *
 * Uses Resend API (free tier: 100 emails/day, 3000/month).
 * Fallback: set SMTP_* vars for any SMTP provider.
 */

const FROM = process.env.EMAIL_FROM || "Clawster <noreply@clawster.run>";

export async function sendCode(to: string, code: string): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    await sendViaResend(to, code);
  } else {
    // Dev fallback — log to console
    console.log(`\n🦞 Magic code for ${to}: ${code}\n`);
  }
}

async function sendViaResend(to: string, code: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: `${code} — Your Clawster login code`,
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
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend failed: ${res.status} ${err}`);
  }
}
