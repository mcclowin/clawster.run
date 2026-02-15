# 🦞 Clawster

**Deploy autonomous AI agents into Trusted Execution Environments.**

Your keys stay yours. We mathematically cannot see them.

## Architecture

```
Frontend (Netlify)          Backend (Railway)          TEE (Phala Cloud)
clawster.run          →     api.clawster.run      →    Phala CVM
                            Express + SQLite            Docker container
                            Stripe billing              OpenClaw agent
                            Telegram auth               age-encrypted secrets
```

## Stack

- **Backend:** Express + TypeScript
- **Database:** SQLite (better-sqlite3)
- **Auth:** Telegram Login Widget + JWT
- **Billing:** Stripe metered subscriptions
- **TEE Provider:** Phala Cloud (Intel TDX)
- **Docker Image:** `ghcr.io/mcclowin/openclaw-tee:latest`

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/telegram` | — | Telegram login callback |
| GET | `/auth/me` | ✓ | Current user |
| POST | `/auth/logout` | — | Clear session |
| GET | `/bots` | ✓ | List bots |
| POST | `/bots/spawn` | ✓ | Provision new bot |
| GET | `/bots/:id/status` | ✓ | Bot status (polls Phala) |
| POST | `/bots/:id/restart` | ✓ | Restart bot |
| DELETE | `/bots/:id` | ✓ | Terminate bot |
| POST | `/billing/checkout` | ✓ | Stripe checkout |
| GET | `/billing/usage` | ✓ | Usage + cost |
| GET | `/billing/portal` | ✓ | Stripe billing portal |
| POST | `/billing/webhook` | — | Stripe events |
| GET | `/image/latest` | — | Docker image tag |
| GET | `/health` | — | Health check |

## Dev

```bash
cp .env.local.example .env.local
npm install
npm run dev     # starts on :3100
```

## Deploy (Railway)

Push to GitHub → Railway auto-deploys from `railway.toml`.

Set env vars in Railway dashboard.

## Meter Worker

Runs hourly via Railway cron:
```bash
npm run meter
```

---

Brain&Bots Technologies © 2026
