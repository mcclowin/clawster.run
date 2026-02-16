#!/usr/bin/env bash
# test-phala.sh — Deploy abuclaw to Phala TEE, test, then tear down.
# Usage: ./test-phala.sh
# Requires: ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER as env vars or in local files.
set -euo pipefail

PHALA_API="https://cloud-api.phala.network/api/v1"
PHALA_KEY=$(cat ~/.config/phala/api_key)
CVM_NAME="test-abuclaw-$(date +%s)"

# --- Load secrets ---
ANTHROPIC_KEY="${ANTHROPIC_API_KEY:-$(cat ~/.config/anthropic/api_key 2>/dev/null || true)}"
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-$(cat ~/.config/telegram-bots/abuclaw.token 2>/dev/null || true)}"
OWNER_ID="${TELEGRAM_OWNER:-1310278446}"
GATEWAY_TOKEN=$(openssl rand -hex 32)

if [[ -z "$ANTHROPIC_KEY" || -z "$BOT_TOKEN" ]]; then
  echo "❌ Missing ANTHROPIC_API_KEY or TELEGRAM_BOT_TOKEN"
  exit 1
fi

echo "🚀 Deploying $CVM_NAME to Phala TEE..."

# --- Generate docker-compose.yml ---
COMPOSE=$(cat <<EOF
services:
  openclaw:
    image: coollabsio/openclaw:latest
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_KEY}
      - TELEGRAM_BOT_TOKEN=${BOT_TOKEN}
      - TELEGRAM_ALLOW_FROM=${OWNER_ID}
      - OPENCLAW_GATEWAY_TOKEN=${GATEWAY_TOKEN}
    ports:
      - "3000:3000"
    restart: unless-stopped
EOF
)

# --- Step 1: Provision ---
echo "📋 Provisioning..."
PROVISION=$(curl -sf -X POST -H "X-API-Key: $PHALA_KEY" -H "Content-Type: application/json" \
  "$PHALA_API/cvms/provision" \
  -d "$(jq -n --arg compose "$COMPOSE" --arg name "$CVM_NAME" '{
    name: $name,
    compose_file: {name: "docker-compose.yml", content: $compose},
    vcpu: 1,
    memory: 2048,
    disk_size: 10
  }')")

COMPOSE_HASH=$(echo "$PROVISION" | jq -r '.compose_hash')
APP_ID=$(echo "$PROVISION" | jq -r '.app_id')
ENCRYPT_KEY=$(echo "$PROVISION" | jq -r '.app_env_encrypt_pubkey')

echo "   compose_hash: $COMPOSE_HASH"
echo "   app_id: $APP_ID"

# --- Step 2: Deploy CVM ---
echo "🏗️  Deploying CVM..."
DEPLOY=$(curl -sf -X POST -H "X-API-Key: $PHALA_KEY" -H "Content-Type: application/json" \
  "$PHALA_API/cvms" \
  -d "$(jq -n \
    --arg name "$CVM_NAME" \
    --arg hash "$COMPOSE_HASH" \
    --arg pubkey "$ENCRYPT_KEY" \
    --arg appid "$APP_ID" \
    '{
      name: $name,
      compose_hash: $hash,
      app_env_encrypt_pubkey: $pubkey,
      app_id: $appid,
      vcpu: 1,
      memory: 2048,
      disk_size: 10,
      instance_type: "tdx.small"
    }')")

CVM_ID=$(echo "$DEPLOY" | jq -r '.id')
echo "   CVM ID: $CVM_ID"
echo "   Status: $(echo "$DEPLOY" | jq -r '.status')"

# --- Step 3: Wait for running ---
echo "⏳ Waiting for CVM to start..."
for i in $(seq 1 60); do
  STATUS=$(curl -sf -H "X-API-Key: $PHALA_KEY" "$PHALA_API/cvms/$CVM_ID" | jq -r '.status')
  if [[ "$STATUS" == "running" ]]; then
    echo "   ✅ CVM is running!"
    break
  elif [[ "$STATUS" == "failed" || "$STATUS" == "error" ]]; then
    echo "   ❌ CVM failed: $STATUS"
    # Cleanup
    curl -sf -X DELETE -H "X-API-Key: $PHALA_KEY" "$PHALA_API/cvms/$CVM_ID" > /dev/null 2>&1 || true
    exit 1
  fi
  printf "   %d/60 status=%s\r" "$i" "$STATUS"
  sleep 5
done

if [[ "$STATUS" != "running" ]]; then
  echo "   ❌ Timed out waiting for CVM (last status: $STATUS)"
  curl -sf -X DELETE -H "X-API-Key: $PHALA_KEY" "$PHALA_API/cvms/$CVM_ID" > /dev/null 2>&1 || true
  exit 1
fi

# --- Step 4: Get app URL and test ---
CVM_INFO=$(curl -sf -H "X-API-Key: $PHALA_KEY" "$PHALA_API/cvms/$CVM_ID")
APP_URL=$(echo "$CVM_INFO" | jq -r '.app_url // empty')
echo ""
echo "📡 CVM Info:"
echo "   URL: ${APP_URL:-"(not yet available)"}"
echo "   VM UUID: $(echo "$CVM_INFO" | jq -r '.vm_uuid')"

# Try to hit the gateway health endpoint
if [[ -n "$APP_URL" ]]; then
  echo ""
  echo "🧪 Testing gateway health..."
  HEALTH=$(curl -sf --max-time 10 "https://${APP_URL}/health" 2>/dev/null || echo "unreachable")
  echo "   Health: $HEALTH"
fi

# --- Step 5: Wait for user test ---
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 @abuclaw_bot should be live on Phala TEE now."
echo "   Send it a message on Telegram to test!"
echo ""
echo "   Gateway token: $GATEWAY_TOKEN"
echo "   CVM ID: $CVM_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Press Enter when done testing to tear down..."

# --- Step 6: Tear down ---
echo "🗑️  Deleting CVM $CVM_ID..."
curl -sf -X DELETE -H "X-API-Key: $PHALA_KEY" "$PHALA_API/cvms/$CVM_ID" > /dev/null 2>&1 || true

# Wait for deletion
for i in $(seq 1 12); do
  DEL_STATUS=$(curl -sf -H "X-API-Key: $PHALA_KEY" "$PHALA_API/cvms/$CVM_ID" 2>/dev/null | jq -r '.status // "gone"')
  if [[ "$DEL_STATUS" == "gone" || "$DEL_STATUS" == "null" ]]; then
    echo "   ✅ CVM deleted."
    break
  fi
  printf "   deleting... (%s)\r" "$DEL_STATUS"
  sleep 5
done

echo ""
echo "✅ Test complete. CVM torn down."
echo "💰 Approximate cost: ~\$0.06/hr × runtime"
