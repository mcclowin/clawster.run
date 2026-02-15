/**
 * Login page — Telegram Login Widget
 */
export default function LoginPage() {
  return (
    <div style={{
      maxWidth: 400, margin: "0 auto", padding: "120px 28px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🦞</div>
      <h1 style={{ fontSize: 18, color: "#e0e4f0", fontWeight: 700, marginBottom: 8 }}>
        Clawster
      </h1>
      <p style={{ fontSize: 12, color: "#5a6080", marginBottom: 40 }}>
        Deploy your bot into a secure enclave
      </p>

      {/* Telegram Login Widget placeholder
          In production, replace with actual Telegram widget script:
          <script async src="https://telegram.org/js/telegram-widget.js?22"
            data-telegram-login="clawster_bot"
            data-size="large"
            data-auth-url="/api/auth/telegram"
            data-request-access="write">
          </script>
      */}
      <div style={{
        background: "#111520",
        border: "1px solid #1c2030",
        borderRadius: 6,
        padding: 32,
      }}>
        <p style={{ fontSize: 12, color: "#8890b0", marginBottom: 20 }}>
          Log in with your Telegram account
        </p>
        <a
          href="#"
          style={{
            display: "inline-block",
            background: "#2AABEE",
            color: "#fff",
            padding: "10px 24px",
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          Login with Telegram
        </a>
        <p style={{ fontSize: 10, color: "#3a4060", marginTop: 16 }}>
          We only get your Telegram ID and username. Nothing else.
        </p>
      </div>

      <div style={{ marginTop: 48, fontSize: 10, color: "#1c2030" }}>
        brain&bots technologies © 2026
      </div>
    </div>
  );
}
