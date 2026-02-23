export default function PrivacyPage() {
  const s = {
    page: { maxWidth: 760, margin: "40px auto", padding: "0 20px", fontFamily: "'JetBrains Mono', monospace", color: "#b8bfe0", lineHeight: 1.9, fontSize: 13 },
    h1: { fontSize: 22, color: "#f97316", fontWeight: 700, marginBottom: 8 },
    h2: { fontSize: 15, color: "#e0e4f0", fontWeight: 600, marginTop: 32, marginBottom: 8 },
    p: { marginBottom: 14, color: "#8890b0" },
    date: { fontSize: 11, color: "#3a4060", marginBottom: 32 },
    link: { color: "#f97316" },
    li: { color: "#8890b0", marginBottom: 6 },
  };

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Privacy Policy</h1>
      <p style={s.date}>Last updated: February 23, 2026</p>

      <h2 style={s.h2}>1. Who We Are</h2>
      <p style={s.p}>Clawster is operated by Brain&amp;Bots. This policy explains what data we collect and how we use it.</p>

      <h2 style={s.h2}>2. Data We Collect</h2>
      <ul>
        <li style={s.li}><strong style={{ color: "#e0e4f0" }}>Account info:</strong> Email address (for login via OTP)</li>
        <li style={s.li}><strong style={{ color: "#e0e4f0" }}>Telegram ID:</strong> Your numeric Telegram user ID (used to set bot ownership)</li>
        <li style={s.li}><strong style={{ color: "#e0e4f0" }}>Payment info:</strong> Processed by Stripe. We never see or store your card number, CVC, or billing address. We store your Stripe customer ID.</li>
        <li style={s.li}><strong style={{ color: "#e0e4f0" }}>Bot metadata:</strong> Bot name, model choice, instance size, creation date, status</li>
        <li style={s.li}><strong style={{ color: "#e0e4f0" }}>Usage data:</strong> Bot uptime hours for billing purposes</li>
      </ul>

      <h2 style={s.h2}>3. Data We Do NOT Collect</h2>
      <ul>
        <li style={s.li}>Your AI API keys — encrypted to TEE hardware, never readable by us</li>
        <li style={s.li}>Your Telegram bot token — same, encrypted to TEE</li>
        <li style={s.li}>Bot conversations, messages, or memory — these exist only inside the TEE</li>
        <li style={s.li}>Analytics, tracking cookies, or third-party trackers — we use none</li>
      </ul>

      <h2 style={s.h2}>4. How We Use Your Data</h2>
      <ul>
        <li style={s.li}>Authenticate you and manage your account</li>
        <li style={s.li}>Provision and manage your bots on Phala Network</li>
        <li style={s.li}>Process billing via Stripe</li>
        <li style={s.li}>Communicate service updates (email only, no marketing spam)</li>
      </ul>

      <h2 style={s.h2}>5. Third Parties</h2>
      <p style={s.p}>We share data only with:</p>
      <ul>
        <li style={s.li}><strong style={{ color: "#e0e4f0" }}>Stripe</strong> — payment processing (<a href="https://stripe.com/privacy" style={s.link}>their privacy policy</a>)</li>
        <li style={s.li}><strong style={{ color: "#e0e4f0" }}>Phala Network</strong> — TEE infrastructure (bot metadata only, not your secrets)</li>
      </ul>
      <p style={s.p}>We do not sell your data. Ever.</p>

      <h2 style={s.h2}>6. Data Retention</h2>
      <p style={s.p}>Account data is retained while your account is active. Bot records are kept for 90 days after termination for billing reconciliation, then deleted. You may request full account deletion by emailing us.</p>

      <h2 style={s.h2}>7. Security</h2>
      <p style={s.p}>Secrets are encrypted client-side using x25519 + AES-GCM before leaving your browser, and are only decryptable inside TEE hardware. Our database stores bot metadata and billing records only. The database is hosted on our own infrastructure, not cloud services.</p>

      <h2 style={s.h2}>8. Your Rights</h2>
      <p style={s.p}>Under UK GDPR, you have the right to: access your data, correct inaccuracies, request deletion, object to processing, and data portability. Contact us to exercise these rights.</p>

      <h2 style={s.h2}>9. Changes</h2>
      <p style={s.p}>We may update this policy. Material changes will be communicated via email.</p>

      <h2 style={s.h2}>10. Contact</h2>
      <p style={s.p}>Data controller: Brain&amp;Bots. Email: <a href="mailto:hello@brainandbot.gg" style={s.link}>hello@brainandbot.gg</a></p>

      <p style={{ ...s.p, marginTop: 40 }}><a href="/dashboard" style={s.link}>← Back to dashboard</a></p>
    </div>
  );
}
