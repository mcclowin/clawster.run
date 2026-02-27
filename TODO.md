# Clawster.run — Production TODO

## 🔴 Bugs (must fix before launch)

### B1: Attestation page crashes
- **Error:** `Objects are not valid as a React child` — attestation API returns raw object, component tries to render it directly
- **Fix:** Serialize attestation data into display-friendly format in the component

### B2: Webhook 400 — signature mismatch
- **Error:** `POST /api/billing/webhook 400` — STRIPE_WEBHOOK_SECRET doesn't match
- **Fix:** Ensure .env has correct signing secret from Stripe dashboard endpoint

### B3: Home/logo link logs user out
- **Issue:** Clicking `/` or home button redirects to login page even when authenticated
- **Fix:** Landing page (`/`) should check auth and redirect to `/dashboard` if logged in, or make nav logo link to `/dashboard` when authenticated

### B4: Logs show "no logs available"
- **Issue:** Bot has logs on Phala but dashboard shows nothing
- **Fix:** Check logs API — likely the Phala logs endpoint URL or CVM ID mapping is wrong. Also got `400` on logs endpoint in the server output.

### B5: Dropdown actions not visible
- **Issue:** Info/Security/etc tabs are hidden behind a click arrow that's nearly invisible
- **Fix:** Either make the arrow more prominent (larger, colored, animated) or show the tabs always expanded by default

### B6: Bot shows "running" while still spinning up
- **Issue:** Phala CVM takes 10-15 min to fully boot. UI shows "running" immediately.
- **Fix:** Add intermediate statuses: `provisioning` → `starting` → `booting` → `running`. Poll Phala status or watch for a specific log line (e.g. "Gateway started" or first Telegram response) to transition to `running`.

## 🟡 Improvements (before launch)

### I1: Payment shows "bolt_money" on bank statement
- **Fix:** Stripe Dashboard → Settings → Public details → Statement descriptor → change to "CLAWSTER"

### I2: API key field accepts anything
- **Issue:** No validation on API key. Hardcoded as `ANTHROPIC_API_KEY` in deploy.
- **Fix:** Either label field "Anthropic API Key" (quick) or add provider dropdown + auto-detect from key prefix (proper)

### I3: Stripe webhook URL hardcoded to clawster.run
- **Issue:** Dev/staging can't receive webhooks without ngrok/Stripe CLI
- **Status:** Workaround with ngrok static domain for dev

### I4: Orphaned subscriptions on failed deploys
- **Issue:** If checkout succeeds but deploy fails, subscription is active with no bot
- **Fix:** Webhook should handle deploy failure — cancel subscription or retry

### I5: Payment failed notification
- **Issue:** `invoice.payment_failed` just logs, doesn't notify user
- **Fix:** Send Telegram message to bot owner when payment fails

### I6: Favicon/tab icon
- **Status:** ✅ Added (logo.jpg as favicon) — needs pull on ThinkPad

### I7: Logo in nav
- **Status:** ✅ Added — needs pull on ThinkPad

## 🟢 Nice to have (post-launch)

### N1: Custom admin dashboard
- View all users, bots, subscriptions
- Cancel/refund/manage from admin UI

### N2: Built-in billing tab
- Show subscription status, invoices, usage inline (not just Stripe portal redirect)

### N3: Multi-provider API key support
- Dropdown: Anthropic / OpenAI / Google
- Set correct env var based on selection

### N4: Boot progress indicator
- WebSocket or polling for real-time boot progress
- Show log stream during boot
- Estimated time remaining

---

_Last updated: 2026-02-27 by McClowin 🍊_
