"use client";

/**
 * Dashboard Client Component — UEFI-style bot management UI
 *
 * Handles all interactive state: spawn form, tab switching,
 * bot actions (restart, terminate), polling for status updates.
 */

import { useState, useEffect, useCallback } from "react";

interface Bot {
  id: string; name: string; status: string; model: string;
  instance_size: string; cvm_endpoint: string | null;
  created_at: string; updated_at: string;
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
  const syncStatuses = useCallback(async () => {
    const active = bots.filter(b => !["terminated", "error"].includes(b.status));
    if (active.length === 0) return;
    const updated = await Promise.all(
      bots.map(async (b) => {
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
  }, [bots]);

  useEffect(() => {
    const interval = setInterval(syncStatuses, 10000);
    syncStatuses(); // immediate first sync
    return () => clearInterval(interval);
  }, [syncStatuses]);

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
        setBots([{ id: data.bot_id, name: data.name, status: data.status, model, instance_size: size, cvm_endpoint: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...bots]);
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

  async function handleTerminate(id: string) {
    if (!confirm("Terminate this bot? This is irreversible.")) return;
    // Instant UI feedback
    setBots(prev => prev.map(b => b.id === id ? { ...b, status: "terminating" } : b));
    const res = await fetch(`/api/bots/${id}`, { method: "DELETE" });
    if (res.ok) {
      setBots(prev => prev.filter(b => b.id !== id));
    } else {
      const data = await res.json().catch(() => ({ error: "Unknown error" }));
      alert(`Termination failed: ${data.error || data.detail || "Unknown error"}`);
      // Revert — polling will fix the real status
      setBots(prev => prev.map(b => b.id === id ? { ...b, status: "error" } : b));
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
        error: { bg: "rgba(248,113,113,0.08)", color: "#f87171", border: "rgba(248,113,113,0.15)" },
        stopped: { bg: "rgba(248,113,113,0.08)", color: "#f87171", border: "rgba(248,113,113,0.15)" },
      };
      const c = colors[status] || colors.stopped;
      return { fontSize: 10, padding: "3px 10px", borderRadius: 3, fontWeight: 500, background: c.bg, color: c.color, border: `1px solid ${c.border}` };
    },
    bottomBar: { background: "#0d1017", borderTop: "1px solid #1c2030", padding: "8px 20px", display: "flex", justifyContent: "space-between", fontSize: 10, color: "#3a4060" } as const,
  };

  const statusLabel: Record<string, string> = {
    running: "● RUNNING", provisioning: "● SPAWNING", error: "● ERROR", stopped: "● STOPPED",
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
                  <option value="small">Small — 1 vCPU · 2 GB · $0.12/hr (~$86/mo)</option>
                  <option value="medium">Medium — 2 vCPU · 4 GB · $0.24/hr (~$173/mo)</option>
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
                Your secrets are sent directly to the TEE hardware enclave. Clawster cannot read them.
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 13, color: "#e0e4f0", fontWeight: 600 }}>🦞 {bot.name}</span>
                    <span style={s.badge(bot.status)}>{statusLabel[bot.status] || "● UNKNOWN"}</span>
                  </div>
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
        <div>clawster.run · v0.1</div>
        <div>brain&bot © 2026</div>
      </div>
    </div>
  );
}
