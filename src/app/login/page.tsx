"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSendCode() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      setStep("code");
    } else {
      const data = await res.json();
      setError(data.error);
    }
    setLoading(false);
  }

  async function handleVerify() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    if (res.ok) {
      // Full page navigation to ensure cookie is sent with the request
      window.location.href = "/dashboard";
      return;
    } else {
      const data = await res.json();
      setError(data.error);
    }
    setLoading(false);
  }

  const s = {
    page: { maxWidth: 400, margin: "0 auto", padding: "120px 28px", textAlign: "center" as const, fontFamily: "'JetBrains Mono', monospace" },
    card: { background: "#111520", border: "1px solid #1c2030", borderRadius: 6, padding: 32 },
    input: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, background: "#080a0f", border: "1px solid #1c2030", color: "#b8bfe0", padding: "12px 16px", borderRadius: 4, width: "100%", outline: "none", textAlign: "center" as const, marginBottom: 16 },
    btn: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, padding: "12px 32px", background: "linear-gradient(135deg, #dc5828, #f97316)", border: "none", color: "#fff", borderRadius: 4, cursor: "pointer", fontWeight: 600, letterSpacing: 1, width: "100%" },
    btnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  };

  return (
    <div style={s.page}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🦞</div>
      <h1 style={{ fontSize: 18, color: "#e0e4f0", fontWeight: 700, marginBottom: 8 }}>Clawster</h1>
      <p style={{ fontSize: 12, color: "#5a6080", marginBottom: 40 }}>Deploy your bot into a secure enclave</p>

      <div style={s.card}>
        {step === "email" ? (
          <>
            <p style={{ fontSize: 12, color: "#8890b0", marginBottom: 20 }}>Enter your email to log in</p>
            <input
              style={s.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendCode()}
            />
            <button
              style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }}
              onClick={handleSendCode}
              disabled={loading || !email}
            >
              {loading ? "SENDING..." : "SEND CODE"}
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "#8890b0", marginBottom: 8 }}>Code sent to</p>
            <p style={{ fontSize: 13, color: "#f97316", marginBottom: 20 }}>{email}</p>
            <input
              style={{ ...s.input, fontSize: 24, letterSpacing: 8 }}
              type="text"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && handleVerify()}
              autoFocus
            />
            <button
              style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }}
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
            >
              {loading ? "VERIFYING..." : "🦞 LOG IN"}
            </button>
            <p
              style={{ fontSize: 11, color: "#3a4060", marginTop: 16, cursor: "pointer" }}
              onClick={() => { setStep("email"); setCode(""); }}
            >
              ← different email
            </p>
          </>
        )}

        {error && <p style={{ fontSize: 12, color: "#f87171", marginTop: 16 }}>{error}</p>}
      </div>

      <p style={{ fontSize: 10, color: "#3a4060", marginTop: 24 }}>
        No password needed. We send a 6-digit code to your email.
      </p>

      <div style={{ marginTop: 48, fontSize: 10, color: "#1c2030" }}>brain&bots technologies © 2026</div>
    </div>
  );
}
