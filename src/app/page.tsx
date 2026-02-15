/**
 * Landing page — clawster.run
 */
export default function Home() {
  return (
    <div style={{
      maxWidth: 680, margin: "0 auto", padding: "80px 28px",
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 24, color: "#e0e4f0", fontWeight: 700, marginBottom: 8 }}>
          🦞 Clawster
        </h1>
        <p style={{ fontSize: 13, color: "#5a6080" }}>
          Deploy autonomous AI agents into secure enclaves.
        </p>
      </div>

      <div style={{
        background: "#111520", border: "1px solid #1c2030", borderRadius: 6,
        padding: 32, marginBottom: 32,
      }}>
        <h2 style={{ fontSize: 15, color: "#b8bfe0", marginBottom: 16 }}>What is this?</h2>
        <p style={{ fontSize: 13, lineHeight: 1.9, color: "#8890b0", marginBottom: 16 }}>
          Clawster spawns <a href="https://github.com/openclaw/openclaw">OpenClaw</a> agents into
          Trusted Execution Environments. Your API keys are encrypted to the TEE hardware —
          we mathematically cannot see them.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.9, color: "#8890b0" }}>
          One click. Your bot runs 24/7 on secure hardware.
          You pay per hour. Cancel anytime.
        </p>
      </div>

      <div style={{
        background: "#111520", border: "1px solid #1c2030", borderRadius: 6,
        padding: 32, marginBottom: 32,
      }}>
        <h2 style={{ fontSize: 15, color: "#b8bfe0", marginBottom: 16 }}>Pricing</h2>
        <div style={{ fontSize: 13, lineHeight: 2.2, color: "#8890b0" }}>
          <div><span style={{ color: "#b8bfe0" }}>Small</span> — 1 vCPU, 2 GB — $0.12/hr (~$86/mo)</div>
          <div><span style={{ color: "#b8bfe0" }}>Medium</span> — 2 vCPU, 4 GB — $0.24/hr (~$173/mo)</div>
          <div style={{ color: "#3a4060", marginTop: 8 }}>No markup on AI API calls. Your keys, your bill.</div>
        </div>
      </div>

      <a
        href="/dashboard"
        style={{
          display: "inline-block",
          background: "linear-gradient(135deg, #dc5828, #f97316)",
          color: "#fff",
          padding: "12px 32px",
          borderRadius: 4,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 1,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        🦞 LAUNCH DASHBOARD
      </a>

      <div style={{ marginTop: 64, fontSize: 10, color: "#1c2030" }}>
        brain&bots technologies © 2026
      </div>
    </div>
  );
}
