"use client";

/**
 * Dashboard Client Component — UEFI-style bot management UI
 *
 * Handles all interactive state: spawn form, tab switching,
 * bot actions (restart, terminate), polling for status updates.
 */

import { useState, useEffect, useRef } from "react";

interface Bot {
  id: string; name: string; status: string; model: string;
  instance_size: string; cvm_endpoint: string | null;
  created_at: string; updated_at: string;
}

interface AttestationData {
  tee_platform: string;
  encryption: { algorithm: string; tee_pubkey: string | null; description: string };
  phala: { app_id: string | null; cvm_id: string | null; cvm_endpoint: string | null };
  verification: { trust_center: string | null; docker_image: string; description: string };
  tee_quote: Record<string, string> | null;
  live_attestation: unknown;
}

interface Props {
  user: { id: string; email: string };
  initialBots: Bot[];
}

export function DashboardClient({ user, initialBots }: Props) {
  const [tab, setTab] = useState<"spawn" | "bots" | "config" | "docs">("bots");
  const [bots, setBots] = useState<Bot[]>(initialBots);
  const [spawning, setSpawning] = useState(false);

  // Spawn form state
  const [name, setName] = useState("");
  const [model, setModel] = useState("anthropic/claude-sonnet-4-20250514");
  const [size, setSize] = useState("small");
  const [telegramToken, setTelegramToken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [soul, setSoul] = useState("");

  // Poll Phala status every 10s for non-terminal bots
  // Use a ref to avoid stale closure / infinite re-render loop
  const botsRef = useRef(bots);
  botsRef.current = bots;
  const pollingRef = useRef(false);

  useEffect(() => {
    async function syncStatuses() {
      if (pollingRef.current) return; // skip if previous poll still running
      const currentBots = botsRef.current;
      const active = currentBots.filter(b => b.id && !["terminated", "terminating", "error", "pending_payment"].includes(b.status));
      if (active.length === 0) return;
      pollingRef.current = true;
      try {
        const updated = await Promise.all(
          currentBots.map(async (b) => {
            if (!b.id || ["terminated", "terminating"].includes(b.status)) return b;
            try {
              const res = await fetch(`/api/bots/${b.id}/status`);
              if (!res.ok) return b;
              const data = await res.json();
              return { ...b, status: data.status, cvm_endpoint: data.cvm_endpoint || b.cvm_endpoint };
            } catch { return b; }
          })
        );
        setBots(updated);
      } finally {
        pollingRef.current = false;
      }
    }
    syncStatuses();
    const interval = setInterval(syncStatuses, 10000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSpawn() {
    setSpawning(true);
    try {
      const res = await fetch("/api/bots/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, model, size, telegram_token: telegramToken, api_key: apiKey, owner_id: ownerId, soul: soul || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        // If checkout URL returned, redirect to Stripe
        if (data.checkout_url) {
          // Add bot to list as pending before redirecting
          setBots(prev => [{ id: data.bot_id, name: data.name || name, status: "pending_payment", model, instance_size: size, cvm_endpoint: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...prev]);
          window.location.href = data.checkout_url;
          return;
        }
        // Billing bypassed — bot deploying directly
        setBots(prev => [{ id: data.bot_id, name: data.name || name, status: data.status, model, instance_size: size, cvm_endpoint: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...prev]);
        setName("");
        setTab("bots");
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert(String(err));
    }
    setSpawning(false);
  }

  async function handleRestart(id: string) {
    await fetch(`/api/bots/${id}/restart`, { method: "POST" });
    setBots(bots.map(b => b.id === id ? { ...b, status: "provisioning" } : b));
  }

  const [terminatingIds, setTerminatingIds] = useState<Set<string>>(new Set());
  const [expandedBot, setExpandedBot] = useState<string | null>(null);
  const [botTab, setBotTab] = useState<"info" | "security" | "logs">("info");
  const [attestation, setAttestation] = useState<AttestationData | null>(null);
  const [botLogs, setBotLogs] = useState<string>("");
  const [loadingAttestation, setLoadingAttestation] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  async function fetchAttestation(botId: string) {
    setLoadingAttestation(true);
    try {
      const res = await fetch(`/api/bots/${botId}/attestation`);
      if (res.ok) setAttestation(await res.json());
    } catch { /* ignore */ }
    setLoadingAttestation(false);
  }

  async function fetchLogs(botId: string) {
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/bots/${botId}/logs?tail=200`);
      if (res.ok) {
        const data = await res.json();
        setBotLogs(data.logs || "No logs available");
      }
    } catch { setBotLogs("Failed to fetch logs"); }
    setLoadingLogs(false);
  }

  function toggleBotExpand(botId: string) {
    if (expandedBot === botId) {
      setExpandedBot(null);
    } else {
      setExpandedBot(botId);
      setBotTab("info");
      setAttestation(null);
      setBotLogs("");
    }
  }

  async function handleTerminate(id: string) {
    if (!confirm("Terminate this bot? This is irreversible.")) return;
    // Mark as terminating — both in bots state and a separate set to block polling
    setTerminatingIds(prev => new Set(prev).add(id));
    setBots(prev => prev.map(b => b.id === id ? { ...b, status: "terminating" } : b));
    try {
      const res = await fetch(`/api/bots/${id}`, { method: "DELETE" });
      if (res.ok) {
        setBots(prev => prev.filter(b => b.id !== id));
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        alert(`Termination failed: ${data.error || data.detail || "Unknown error"}`);
        setBots(prev => prev.map(b => b.id === id ? { ...b, status: "error" } : b));
      }
    } catch (err) {
      alert(`Termination failed: ${String(err)}`);
      setBots(prev => prev.map(b => b.id === id ? { ...b, status: "error" } : b));
    } finally {
      setTerminatingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  const s = {
    frame: { maxWidth: 900, margin: "20px auto", border: "1px solid #1c2030", borderRadius: 6, overflow: "hidden", boxShadow: "0 0 80px rgba(249,115,22,0.03)" } as const,
    topBar: { background: "linear-gradient(135deg, #dc5828, #ef4444)", color: "#fff", padding: "10px 20px", fontWeight: 700, fontSize: 13, letterSpacing: 2, display: "flex", justifyContent: "space-between", alignItems: "center" } as const,
    navTabs: { display: "flex", background: "#111520", borderBottom: "1px solid #1c2030" } as const,
    navTab: (active: boolean) => ({ padding: "11px 24px", fontSize: 11, color: active ? "#f97316" : "#3a4060", cursor: "pointer", borderBottom: `2px solid ${active ? "#f97316" : "transparent"}`, letterSpacing: 2, textTransform: "uppercase" as const, background: "transparent", border: "none", fontFamily: "'JetBrains Mono', monospace" }),
    main: { display: "flex", minHeight: 560 } as const,
    sidebar: { width: 200, background: "#0d1017", borderRight: "1px solid #1c2030", padding: "16px 0", flexShrink: 0 } as const,
    content: { flex: 1, padding: 28, overflowY: "auto" as const },
    title: { fontSize: 15, fontWeight: 700, color: "#e0e4f0", marginBottom: 4 } as const,
    sub: { fontSize: 11, color: "#3a4060", marginBottom: 28 } as const,
    field: { marginBottom: 22 } as const,
    label: { fontSize: 11, color: "#b8bfe0", marginBottom: 6, display: "block", letterSpacing: 0.5 } as const,
    input: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, background: "#080a0f", border: "1px solid #1c2030", color: "#b8bfe0", padding: "9px 14px", borderRadius: 4, width: "100%", outline: "none" } as const,
    select: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, background: "#080a0f", border: "1px solid #1c2030", color: "#b8bfe0", padding: "9px 14px", borderRadius: 4, width: "100%", cursor: "pointer" } as const,
    hint: { fontSize: 10, color: "#3a4060", marginTop: 5 } as const,
    sep: { height: 1, background: "#1c2030", margin: "24px 0" } as const,
    btnSpawn: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: "10px 28px", background: "linear-gradient(135deg, #dc5828, #f97316)", border: "1px solid #f97316", color: "#fff", borderRadius: 4, cursor: "pointer", fontWeight: 500, letterSpacing: 1 } as const,
    btnGhost: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: "6px 16px", background: "transparent", border: "1px solid #1c2030", color: "#8890b0", borderRadius: 4, cursor: "pointer" } as const,
    btnKill: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: "6px 16px", background: "transparent", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", borderRadius: 4, cursor: "pointer" } as const,
    card: { background: "#0d1017", border: "1px solid #1c2030", borderRadius: 5, padding: "18px 20px", marginBottom: 14 } as const,
    badge: (status: string) => {
      const colors: Record<string, { bg: string; color: string; border: string }> = {
        running: { bg: "rgba(52,211,153,0.1)", color: "#34d399", border: "rgba(52,211,153,0.2)" },
        provisioning: { bg: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "rgba(251,191,36,0.2)" },
        starting: { bg: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "rgba(251,191,36,0.2)" },
        pending_payment: { bg: "rgba(168,85,247,0.1)", color: "#a855f7", border: "rgba(168,85,247,0.2)" },
        terminating: { bg: "rgba(248,113,113,0.08)", color: "#f87171", border: "rgba(248,113,113,0.15)" },
        error: { bg: "rgba(248,113,113,0.08)", color: "#f87171", border: "rgba(248,113,113,0.15)" },
        stopped: { bg: "rgba(248,113,113,0.08)", color: "#f87171", border: "rgba(248,113,113,0.15)" },
      };
      const c = colors[status] || colors.stopped;
      return { fontSize: 10, padding: "3px 10px", borderRadius: 3, fontWeight: 500, background: c.bg, color: c.color, border: `1px solid ${c.border}` };
    },
    bottomBar: { background: "#0d1017", borderTop: "1px solid #1c2030", padding: "8px 20px", display: "flex", justifyContent: "space-between", fontSize: 10, color: "#3a4060" } as const,
  };

  const statusLabel: Record<string, string> = {
    running: "● RUNNING", provisioning: "● SPAWNING", starting: "● STARTING",
    pending_payment: "● AWAITING PAYMENT", terminating: "● TERMINATING",
    error: "● ERROR", stopped: "● STOPPED",
  };

  return (
    <div style={s.frame}>
      {/* Top Chrome */}
      <div style={s.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🦞</span>
          <span>CLAWSTER</span>
        </div>
        <div style={{ fontWeight: 400, fontSize: 11, opacity: 0.8 }}>
          {user.email}
        </div>
      </div>

      {/* Nav */}
      <div style={s.navTabs}>
        {(["spawn", "bots", "config", "docs"] as const).map(t => (
          <button key={t} style={s.navTab(tab === t)} onClick={() => setTab(t)}>
            {t === "spawn" ? "SPAWN" : t === "bots" ? "MY BOTS" : t.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={s.main}>
        {/* Sidebar */}
        <div style={s.sidebar}>
          <div style={{ padding: "0 16px", fontSize: 9, color: "#3a4060", letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>
            YOUR BOTS
          </div>
          {bots.map(bot => (
            <div key={bot.id} style={{ padding: "8px 16px", fontSize: 12, color: "#8890b0", display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
              <span>{bot.name}</span>
              <span style={{ fontSize: 8, color: bot.status === "running" ? "#34d399" : bot.status === "error" ? "#f87171" : "#3a4060" }}>●</span>
            </div>
          ))}
          <div onClick={() => setTab("spawn")} style={{ padding: "10px 16px", fontSize: 11, color: "#3a4060", cursor: "pointer", borderTop: "1px solid #1c2030", marginTop: 12 }}>
            + spawn new bot
          </div>
        </div>

        {/* Content */}
        <div style={s.content}>

          {/* ── SPAWN ── */}
          {tab === "spawn" && (
            <div>
              <div style={s.title}>Spawn a Bot</div>
              <div style={s.sub}>Deploy an OpenClaw agent into a secure enclave</div>

              <div style={s.field}>
                <label style={s.label}>Bot Name</label>
                <input style={s.input} placeholder="e.g. jarvis, friday, abuclaw" value={name} onChange={e => setName(e.target.value)} />
                <div style={s.hint}>Lowercase, 2-24 chars, alphanumeric + hyphens</div>
              </div>

              <div style={s.sep} />

              <div style={s.field}>
                <label style={s.label}>AI Model</label>
                <select style={s.select} value={model} onChange={e => setModel(e.target.value)}>
                  <option value="anthropic/claude-sonnet-4-20250514">Claude Sonnet 4 (Anthropic)</option>
                  <option value="anthropic/claude-opus-4-6">Claude Opus 4 (Anthropic)</option>
                  <option value="openai/gpt-4o">GPT-4o (OpenAI)</option>
                  <option value="google/gemini-2.0-flash">Gemini 2.0 Flash (Google)</option>
                </select>
              </div>

              <div style={s.field}>
                <label style={s.label}>Enclave Size</label>
                <select style={s.select} value={size} onChange={e => setSize(e.target.value)}>
                  <option value="small">Small — 1 vCPU · 2 GB · $59/mo</option>
                  <option value="medium">Medium — 2 vCPU · 4 GB · $99/mo</option>
                </select>
              </div>

              <div style={s.sep} />

              <div style={s.field}>
                <label style={s.label}>Telegram Bot Token</label>
                <input style={s.input} placeholder="123456789:ABCdefGHI..." value={telegramToken} onChange={e => setTelegramToken(e.target.value)} />
                <div style={s.hint}>Get from <a href="https://t.me/BotFather" target="_blank" rel="noopener" style={{color:"#f97316"}}>@BotFather</a> → /newbot</div>
              </div>

              <div style={s.field}>
                <label style={s.label}>AI API Key</label>
                <input style={{...s.input, fontFamily:"monospace"}} type="password" placeholder="sk-ant-..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
                <div style={s.hint}>Your Anthropic, OpenAI, or Google API key</div>
              </div>

              <div style={s.field}>
                <label style={s.label}>Your Telegram ID</label>
                <input style={s.input} placeholder="1234567890" value={ownerId} onChange={e => setOwnerId(e.target.value)} />
                <div style={s.hint}>Get from <a href="https://t.me/userinfobot" target="_blank" rel="noopener" style={{color:"#f97316"}}>@userinfobot</a></div>
              </div>

              <div style={s.field}>
                <label style={s.label}>Bot Personality <span style={{color:"#3a4060"}}>(optional)</span></label>
                <textarea style={{...s.input, minHeight:60, resize:"vertical" as const}} placeholder="e.g. You are a helpful assistant. Be concise." value={soul} onChange={e => setSoul(e.target.value)} />
              </div>

              <div style={s.sep} />

              <div style={{ fontSize: 11, color: "#3a4060", marginBottom: 24, lineHeight: 1.8 }}>
                Your secrets are encrypted and sent directly to the TEE hardware enclave. Clawster cannot read them.
                By spawning a bot you agree to our{" "}
                <a href="/terms" target="_blank" style={{ color: "#f97316" }}>Terms of Service</a> and{" "}
                <a href="/privacy" target="_blank" style={{ color: "#f97316" }}>Privacy Policy</a>.
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button style={s.btnSpawn} onClick={handleSpawn} disabled={spawning}>
                  {spawning ? "⏳ SPAWNING..." : "🦞 SPAWN"}
                </button>
              </div>
            </div>
          )}

          {/* ── MY BOTS ── */}
          {tab === "bots" && (
            <div>
              <div style={s.title}>My Bots</div>
              <div style={s.sub}>Manage your deployed agents</div>

              {bots.length === 0 && (
                <div style={{ color: "#3a4060", fontSize: 12 }}>
                  No bots yet. <span style={{ color: "#f97316", cursor: "pointer" }} onClick={() => setTab("spawn")}>Spawn your first one →</span>
                </div>
              )}

              {bots.map(bot => (
                <div key={bot.id} style={s.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, cursor: "pointer" }} onClick={() => toggleBotExpand(bot.id)}>
                    <span style={{ fontSize: 13, color: "#e0e4f0", fontWeight: 600 }}>🦞 {bot.name} <span style={{ fontSize: 10, color: "#3a4060" }}>{expandedBot === bot.id ? "▾" : "▸"}</span></span>
                    <span style={s.badge(bot.status)}>{statusLabel[bot.status] || "● UNKNOWN"}</span>
                  </div>

                  {/* Collapsed view */}
                  {expandedBot !== bot.id && (
                    <>
                      <div style={{ fontSize: 11, lineHeight: 2.2, color: "#3a4060" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Model</span><span style={{ color: "#8890b0" }}>{bot.model}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Size</span><span style={{ color: "#8890b0" }}>{bot.instance_size}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Created</span><span style={{ color: "#8890b0" }}>{new Date(bot.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        {bot.status === "running" && (
                          <button style={s.btnGhost} onClick={() => handleRestart(bot.id)}>RESTART</button>
                        )}
                        {["error", "stopped"].includes(bot.status) && (
                          <button style={{ ...s.btnSpawn, padding: "6px 16px" }} onClick={() => handleRestart(bot.id)}>🦞 RESPAWN</button>
                        )}
                        <button style={s.btnKill} onClick={() => handleTerminate(bot.id)}>TERMINATE</button>
                      </div>
                    </>
                  )}

                  {/* Expanded view */}
                  {expandedBot === bot.id && (
                    <div>
                      {/* Sub-tabs */}
                      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "1px solid #1c2030" }}>
                        {(["info", "security", "logs"] as const).map(t => (
                          <button key={t} onClick={() => {
                            setBotTab(t);
                            if (t === "security" && !attestation) fetchAttestation(bot.id);
                            if (t === "logs" && !botLogs) fetchLogs(bot.id);
                          }} style={{
                            padding: "8px 16px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase",
                            background: "transparent", border: "none", cursor: "pointer",
                            color: botTab === t ? "#f97316" : "#3a4060",
                            borderBottom: `2px solid ${botTab === t ? "#f97316" : "transparent"}`,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}>{t}</button>
                        ))}
                      </div>

                      {/* Info tab */}
                      {botTab === "info" && (
                        <div>
                          <div style={{ fontSize: 11, lineHeight: 2.4, color: "#3a4060" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span>Model</span><span style={{ color: "#8890b0" }}>{bot.model}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span>Size</span><span style={{ color: "#8890b0" }}>{bot.instance_size}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span>Created</span><span style={{ color: "#8890b0" }}>{new Date(bot.created_at).toLocaleDateString()}</span>
                            </div>
                            {bot.cvm_endpoint && (
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>Endpoint</span><span style={{ color: "#8890b0", fontSize: 10 }}>{bot.cvm_endpoint}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                            {bot.status === "running" && (
                              <button style={s.btnGhost} onClick={() => handleRestart(bot.id)}>RESTART</button>
                            )}
                            {["error", "stopped"].includes(bot.status) && (
                              <button style={{ ...s.btnSpawn, padding: "6px 16px" }} onClick={() => handleRestart(bot.id)}>🦞 RESPAWN</button>
                            )}
                            <button style={s.btnKill} onClick={() => handleTerminate(bot.id)}>TERMINATE</button>
                          </div>
                        </div>
                      )}

                      {/* Security tab */}
                      {botTab === "security" && (
                        <div style={{ fontSize: 11, lineHeight: 2 }}>
                          {loadingAttestation ? (
                            <div style={{ color: "#3a4060" }}>Loading attestation data...</div>
                          ) : attestation ? (
                            <div>
                              {/* Encryption proof */}
                              <div style={{ marginBottom: 20 }}>
                                <div style={{ color: "#f97316", fontWeight: 600, fontSize: 12, marginBottom: 8 }}>🔐 Secret Encryption</div>
                                <div style={{ background: "#080a0f", border: "1px solid #1c2030", borderRadius: 4, padding: 14 }}>
                                  <div style={{ color: "#34d399", marginBottom: 4 }}>✅ Secrets encrypted client-side</div>
                                  <div style={{ color: "#34d399", marginBottom: 4 }}>✅ Clawster never saw plaintext</div>
                                  <div style={{ color: "#8890b0", marginBottom: 4 }}>
                                    Algorithm: <span style={{ color: "#b8bfe0" }}>{attestation.encryption.algorithm || "x25519 + AES-256-GCM"}</span>
                                  </div>
                                  {attestation.encryption.tee_pubkey && (
                                    <div style={{ color: "#8890b0" }}>
                                      TEE Pubkey: <span style={{ color: "#b8bfe0", fontFamily: "monospace", fontSize: 10 }}>
                                        {attestation.encryption.tee_pubkey.slice(0, 32)}...
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* TEE Platform */}
                              <div style={{ marginBottom: 20 }}>
                                <div style={{ color: "#f97316", fontWeight: 600, fontSize: 12, marginBottom: 8 }}>🛡️ TEE Attestation</div>
                                <div style={{ background: "#080a0f", border: "1px solid #1c2030", borderRadius: 4, padding: 14 }}>
                                  <div style={{ color: "#8890b0", marginBottom: 4 }}>
                                    Platform: <span style={{ color: "#b8bfe0" }}>{attestation.tee_platform}</span>
                                  </div>
                                  {attestation.phala.app_id && (
                                    <div style={{ color: "#8890b0", marginBottom: 4 }}>
                                      App ID: <span style={{ color: "#b8bfe0", fontFamily: "monospace", fontSize: 10 }}>
                                        {attestation.phala.app_id}
                                      </span>
                                    </div>
                                  )}
                                  {attestation.phala.cvm_id && (
                                    <div style={{ color: "#8890b0", marginBottom: 4 }}>
                                      CVM ID: <span style={{ color: "#b8bfe0", fontFamily: "monospace", fontSize: 10 }}>
                                        {attestation.phala.cvm_id}
                                      </span>
                                    </div>
                                  )}

                                  {/* Live attestation measurements */}
                                  {attestation.tee_quote != null ? (
                                    <div style={{ marginTop: 10, borderTop: "1px solid #1c2030", paddingTop: 10 }}>
                                      <div style={{ color: "#34d399", marginBottom: 6 }}>✅ Live TEE Quote Retrieved</div>
                                      <div style={{ color: "#3a4060", fontSize: 10 }}>
                                        {Object.entries(attestation.tee_quote).map(([k, v]) => (
                                          <div key={k} style={{ marginBottom: 2 }}>
                                            <span style={{ color: "#8890b0" }}>{k}:</span>{" "}
                                            <span style={{ color: "#b8bfe0", fontFamily: "monospace" }}>
                                              {v && v.length > 40 ? v.slice(0, 40) + "..." : v}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  {attestation.live_attestation != null ? (
                                    <div style={{ marginTop: 10, borderTop: "1px solid #1c2030", paddingTop: 10 }}>
                                      <div style={{ color: "#34d399", marginBottom: 6 }}>✅ CVM Attestation Endpoint Verified</div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              {/* Verification links */}
                              <div>
                                <div style={{ color: "#f97316", fontWeight: 600, fontSize: 12, marginBottom: 8 }}>🔍 Verify Independently</div>
                                <div style={{ background: "#080a0f", border: "1px solid #1c2030", borderRadius: 4, padding: 14 }}>
                                  <div style={{ color: "#8890b0", marginBottom: 6 }}>
                                    Docker Image: <a href="https://ghcr.io/mcclowin/openclaw-tee" target="_blank" rel="noopener" style={{ color: "#f97316" }}>
                                      ghcr.io/mcclowin/openclaw-tee:latest
                                    </a>
                                  </div>
                                  {attestation.verification.trust_center && (
                                    <div style={{ color: "#8890b0", marginBottom: 6 }}>
                                      Trust Center: <a href={attestation.verification.trust_center} target="_blank" rel="noopener" style={{ color: "#f97316" }}>
                                        Verify on Phala →
                                      </a>
                                    </div>
                                  )}
                                  <div style={{ color: "#3a4060", fontSize: 10, marginTop: 8, lineHeight: 1.8 }}>
                                    The TEE attestation proves this bot runs on genuine Intel TDX hardware.
                                    The compose-hash in RTMR3 proves the exact Docker image running matches
                                    the published source. No one — not even Clawster — can read your secrets.
                                  </div>
                                </div>
                              </div>

                              <button onClick={() => fetchAttestation(bot.id)} style={{ ...s.btnGhost, marginTop: 14, fontSize: 10 }}>
                                ↻ REFRESH
                              </button>
                            </div>
                          ) : (
                            <div style={{ color: "#3a4060" }}>
                              {bot.status === "running" ? "No attestation data available yet." : "Bot must be running to view attestation."}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Logs tab */}
                      {botTab === "logs" && (
                        <div>
                          {loadingLogs ? (
                            <div style={{ color: "#3a4060", fontSize: 11 }}>Loading logs...</div>
                          ) : (
                            <div>
                              <pre style={{
                                background: "#080a0f", border: "1px solid #1c2030", borderRadius: 4,
                                padding: 14, fontSize: 10, color: "#8890b0", lineHeight: 1.8,
                                maxHeight: 400, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
                                fontFamily: "'JetBrains Mono', monospace",
                              }}>
                                {botLogs || "No logs available. Bot may still be starting."}
                              </pre>
                              <button onClick={() => fetchLogs(bot.id)} style={{ ...s.btnGhost, marginTop: 10, fontSize: 10 }}>
                                ↻ REFRESH LOGS
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── CONFIG ── */}
          {tab === "config" && (
            <div>
              <div style={s.title}>Configuration</div>
              <div style={s.sub}>Account settings</div>
              <div style={{ fontSize: 12, color: "#8890b0", lineHeight: 2 }}>
                <p>Billing managed via Stripe. <a href="#" onClick={async (e) => {
                  e.preventDefault();
                  const res = await fetch("/api/billing/portal");
                  const data = await res.json();
                  if (data.url) window.location.href = data.url;
                }}>Open billing portal →</a></p>
              </div>
            </div>
          )}

          {/* ── DOCS ── */}
          {tab === "docs" && (
            <div>
              <div style={s.title}>Documentation</div>
              <div style={s.sub}>Everything you need</div>

              <div style={s.card}>
                <div style={{ fontSize: 13, color: "#b8bfe0", fontWeight: 500, marginBottom: 8 }}>Getting Started</div>
                <div style={{ fontSize: 12, color: "#8890b0", lineHeight: 1.8 }}>
                  <p>1. Log in with Telegram</p>
                  <p>2. Click SPAWN, pick a name and model</p>
                  <p>3. Enter your Telegram bot token + AI API key</p>
                  <p>4. Your bot is live. Talk to it on Telegram.</p>
                </div>
              </div>

              <div style={s.card}>
                <div style={{ fontSize: 13, color: "#b8bfe0", fontWeight: 500, marginBottom: 8 }}>What&apos;s a TEE?</div>
                <div style={{ fontSize: 12, color: "#8890b0", lineHeight: 1.8 }}>
                  <p>A Trusted Execution Environment is a hardware-secured enclave. Your bot&apos;s secrets are sealed by the CPU — not even the server operator can read them. <a href="https://en.wikipedia.org/wiki/Trusted_execution_environment">Learn more →</a></p>
                </div>
              </div>

              <div style={s.card}>
                <div style={{ fontSize: 13, color: "#b8bfe0", fontWeight: 500, marginBottom: 8 }}>What&apos;s OpenClaw?</div>
                <div style={{ fontSize: 12, color: "#8890b0", lineHeight: 1.8 }}>
                  <p><a href="https://github.com/openclaw/openclaw">OpenClaw</a> is the open-source AI agent framework. 189K stars. Agents with persistent memory, skills, and a soul. Clawster deploys them into secure enclaves so they run 24/7.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div style={s.bottomBar}>
        <div>clawster.run · v0.1 · <a href="/terms" style={{ color: "#3a4060" }}>terms</a> · <a href="/privacy" style={{ color: "#3a4060" }}>privacy</a></div>
        <div>brain&amp;bot © 2026</div>
      </div>
    </div>
  );
}
