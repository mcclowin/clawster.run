export default function TermsPage() {
  const s = {
    page: { maxWidth: 760, margin: "40px auto", padding: "0 20px", fontFamily: "'JetBrains Mono', monospace", color: "#b8bfe0", lineHeight: 1.9, fontSize: 13 },
    h1: { fontSize: 22, color: "#f97316", fontWeight: 700, marginBottom: 8 },
    h2: { fontSize: 15, color: "#e0e4f0", fontWeight: 600, marginTop: 32, marginBottom: 8 },
    p: { marginBottom: 14, color: "#8890b0" },
    date: { fontSize: 11, color: "#3a4060", marginBottom: 32 },
    link: { color: "#f97316" },
  };

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Terms of Service</h1>
      <p style={s.date}>Last updated: February 23, 2026</p>

      <h2 style={s.h2}>1. Service</h2>
      <p style={s.p}>Clawster (&quot;Service&quot;), operated by Brain&amp;Bots (&quot;we&quot;, &quot;us&quot;), deploys OpenClaw AI agents into Trusted Execution Environments (TEEs) on the Phala Network. By using the Service you agree to these terms.</p>

      <h2 style={s.h2}>2. Accounts</h2>
      <p style={s.p}>You must provide a valid email address to create an account. You are responsible for all activity under your account. One human per account — no shared or resold accounts.</p>

      <h2 style={s.h2}>3. Billing &amp; Payment</h2>
      <p style={s.p}>Bot hosting is billed as a monthly subscription per bot. Prices are displayed at time of spawn (currently: Small $86/mo, Medium $173/mo). Payment is processed by Stripe. We do not store your card details.</p>
      <p style={s.p}>Subscriptions renew automatically each month. You may cancel at any time from your billing portal. Cancellation takes effect immediately — your bot will be terminated and you will receive a pro-rated refund for unused time in the current billing period via Stripe.</p>

      <h2 style={s.h2}>4. Refunds</h2>
      <p style={s.p}>When you cancel a bot subscription, Stripe automatically calculates and issues a pro-rated credit for the remaining days. No partial-day refunds. Refunds for the first 24 hours may be requested by contacting us.</p>

      <h2 style={s.h2}>5. Your Secrets &amp; TEE Security</h2>
      <p style={s.p}>Secrets you provide (API keys, bot tokens) are encrypted client-side and sent directly to TEE hardware. Clawster&apos;s servers never see your plaintext secrets. However, we make no warranty that TEE technology is impenetrable — you use the Service at your own risk.</p>

      <h2 style={s.h2}>6. Acceptable Use</h2>
      <p style={s.p}>You may not use the Service to: (a) violate any law; (b) send spam or unsolicited messages; (c) deploy bots that harass, impersonate, or defraud; (d) circumvent platform terms of service (Telegram, etc.); (e) mine cryptocurrency; (f) run workloads unrelated to AI agent hosting.</p>
      <p style={s.p}>We reserve the right to terminate bots and accounts that violate these terms without refund.</p>

      <h2 style={s.h2}>7. Availability &amp; SLA</h2>
      <p style={s.p}>Clawster is a beta service. We do not guarantee uptime, availability, or data persistence. TEE infrastructure is provided by Phala Network — outages on their end are outside our control. We will make reasonable efforts to notify you of planned downtime.</p>

      <h2 style={s.h2}>8. Termination</h2>
      <p style={s.p}>We may suspend or terminate your bots if: (a) payment fails after a 48-hour grace period; (b) you violate these terms; (c) we discontinue the Service. You may terminate your bots at any time from the dashboard.</p>

      <h2 style={s.h2}>9. Limitation of Liability</h2>
      <p style={s.p}>To the maximum extent permitted by law, our total liability is limited to the amount you paid us in the 30 days preceding the claim. We are not liable for indirect, incidental, or consequential damages, lost data, or lost profits.</p>

      <h2 style={s.h2}>10. Changes</h2>
      <p style={s.p}>We may update these terms. Material changes will be communicated via email or dashboard notification. Continued use after changes constitutes acceptance.</p>

      <h2 style={s.h2}>11. Governing Law</h2>
      <p style={s.p}>These terms are governed by the laws of England and Wales. Disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>

      <h2 style={s.h2}>12. Contact</h2>
      <p style={s.p}>Questions? Email <a href="mailto:hello@brainandbot.gg" style={s.link}>hello@brainandbot.gg</a></p>

      <p style={{ ...s.p, marginTop: 40 }}><a href="/dashboard" style={s.link}>← Back to dashboard</a></p>
    </div>
  );
}
