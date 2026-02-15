# 🦞 Clawster

**Deploy autonomous AI agents into Trusted Execution Environments.**

Your keys stay yours. We mathematically cannot see them.

## Architecture

```
Next.js Monolith (Railway)
clawster.run
├── /                    Landing page
├── /login               Telegram OAuth
├── /dashboard           UEFI-style bot management
└── /api/*               Backend endpoints
    ├── /auth/*           Telegram login + JWT
    ├── /bots/*           CRUD + Phala provisioning
    ├── /billing/*        Stripe metered billing
    └── /image/latest     Docker image version
```

## Stack

- **Framework:** Next.js 15 (App Router, Server Components)
- **Database:** SQLite (better-sqlite3, WAL mode)
- **Auth:** Telegram Login Widget + JWT (httpOnly cookies)
- **Billing:** Stripe metered subscriptions
- **TEE Provider:** Phala Cloud (Intel TDX)
- **Docker Image:** `ghcr.io/mcclowin/openclaw-tee:latest`
- **Hosting:** Railway

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/telegram` | — | Telegram login |
| GET | `/api/auth/me` | ✓ | Current user |
| POST | `/api/auth/logout` | — | Clear session |
| GET | `/api/bots` | ✓ | List bots |
| POST | `/api/bots/spawn` | ✓ | Provision new bot |
| GET | `/api/bots/:id/status` | ✓ | Live status |
| POST | `/api/bots/:id/restart` | ✓ | Restart bot |
| DELETE | `/api/bots/:id` | ✓ | Terminate bot |
| POST | `/api/billing/checkout` | ✓ | Stripe checkout |
| GET | `/api/billing/usage` | ✓ | Usage + cost |
| GET | `/api/billing/portal` | ✓ | Billing portal |
| POST | `/api/billing/webhook` | — | Stripe events |
| GET | `/api/image/latest` | — | Docker image tag |
| GET | `/api/health` | — | Health check |

## Dev

```bash
cp .env.local.example .env.local
npm install
npm run dev     # http://localhost:3100
```

## Deploy (Railway)

Push to GitHub → connect repo in Railway → auto-deploys.
Set env vars in Railway dashboard. Custom domain: clawster.run.

---

Brain&Bots Technologies © 2026
