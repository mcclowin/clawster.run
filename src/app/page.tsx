import Link from "next/link";

export default function Home() {
  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <span className="lobster">🦞</span> CLAWSTER
        </div>
        <div className="landing-nav-links">
          <a href="https://github.com/openclaw/openclaw" target="_blank" rel="noopener">GitHub</a>
          <a href="https://docs.openclaw.ai" target="_blank" rel="noopener">Docs</a>
          <Link href="/login" className="landing-btn-sm">Log In</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-badge">TRUSTED EXECUTION ENVIRONMENT</div>
        <h1>Your AI agent.<br />Running 24/7.<br /><span className="accent">Tamper-proof.</span></h1>
        <p className="landing-hero-sub">
          Deploy an <a href="https://github.com/openclaw/openclaw">OpenClaw</a> agent into a hardware-secured
          enclave in under 60 seconds. Your API keys are sealed by the CPU&nbsp;—
          not even we can read them.
        </p>
        <div className="landing-hero-actions">
          <Link href="/login" className="landing-btn-primary">🦞 SPAWN YOUR BOT</Link>
          <a href="#how" className="landing-btn-ghost">How it works ↓</a>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="landing-section">
        <h2>Three steps. One minute.</h2>
        <div className="landing-steps">
          <div className="landing-step">
            <div className="landing-step-num">01</div>
            <div className="landing-step-title">Sign in</div>
            <div className="landing-step-desc">Email + 6-digit code. No password, no friction.</div>
          </div>
          <div className="landing-step">
            <div className="landing-step-num">02</div>
            <div className="landing-step-title">Configure</div>
            <div className="landing-step-desc">Pick a name, model, and size. Paste your Telegram bot token + AI API key. Everything is encrypted to TEE hardware before leaving your browser.</div>
          </div>
          <div className="landing-step">
            <div className="landing-step-num">03</div>
            <div className="landing-step-title">Spawn</div>
            <div className="landing-step-desc">Your bot boots inside a secure enclave and connects to Telegram. Talk to it. It remembers, learns, and runs skills.</div>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="landing-section">
        <h2>What&apos;s inside the enclave</h2>
        <div className="landing-grid">
          <div className="landing-card">
            <div className="landing-card-icon">🔒</div>
            <div className="landing-card-title">Hardware isolation</div>
            <div className="landing-card-desc">Intel TDX encrypts memory at the CPU level. No one — not the host, not us — can inspect your agent&apos;s runtime.</div>
          </div>
          <div className="landing-card">
            <div className="landing-card-icon">🧠</div>
            <div className="landing-card-title">Persistent memory</div>
            <div className="landing-card-desc">Your bot wakes up knowing who it is. Long-term memory, daily notes, personality — all stored inside the enclave.</div>
          </div>
          <div className="landing-card">
            <div className="landing-card-icon">⚡</div>
            <div className="landing-card-title">Always on</div>
            <div className="landing-card-desc">No laptop to keep open. No VPS to babysit. Your bot runs 24/7 on dedicated hardware with automatic restarts.</div>
          </div>
          <div className="landing-card">
            <div className="landing-card-icon">🔧</div>
            <div className="landing-card-title">Full OpenClaw</div>
            <div className="landing-card-desc">Not a stripped-down version. The real thing — skills, tools, web browsing, cron jobs, multi-channel messaging.</div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="landing-section">
        <h2>Simple pricing</h2>
        <p className="landing-section-sub">Pay per hour. No contracts. Cancel anytime.</p>
        <div className="landing-pricing">
          <div className="landing-price-card">
            <div className="landing-price-tier">Small</div>
            <div className="landing-price-specs">1 vCPU · 2 GB RAM</div>
            <div className="landing-price-amount">$0.12<span>/hr</span></div>
            <div className="landing-price-monthly">~$86/mo</div>
          </div>
          <div className="landing-price-card featured">
            <div className="landing-price-tier">Medium</div>
            <div className="landing-price-specs">2 vCPU · 4 GB RAM</div>
            <div className="landing-price-amount">$0.24<span>/hr</span></div>
            <div className="landing-price-monthly">~$173/mo</div>
          </div>
        </div>
        <p className="landing-pricing-note">
          You bring your own AI API key. No markup on model usage — your key, your bill.
        </p>
      </section>

      {/* CTA */}
      <section className="landing-section landing-cta">
        <h2>Ready to deploy?</h2>
        <p>Your bot is one click away from running in a secure enclave.</p>
        <Link href="/login" className="landing-btn-primary">🦞 GET STARTED</Link>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div>clawster.run · <a href="https://brainandbot.gg">brain&bot</a> © 2026</div>
        <div>
          Powered by <a href="https://github.com/openclaw/openclaw">OpenClaw</a> + <a href="https://phala.network">Phala Network</a>
        </div>
      </footer>
    </div>
  );
}
