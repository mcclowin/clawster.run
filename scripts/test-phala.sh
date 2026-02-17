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

# --- Generate docker-compose YAML ---
DOCKER_COMPOSE="services:
  openclaw:
    image: ghcr.io/mcclowin/openclaw-tee:latest
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_KEY}
      - TELEGRAM_BOT_TOKEN=${BOT_TOKEN}
      - TELEGRAM_OWNER_ID=${OWNER_ID}
      - GATEWAY_TOKEN=${GATEWAY_TOKEN}
    ports:
      - \"3000:3000\"
    restart: unless-stopped"

# --- Step 1: Provision ---
echo "📋 Provisioning..."
PROVISION=$(curl -sf -X POST -H "X-API-Key: $PHALA_KEY" -H "Content-Type: application/json" \
  "$PHALA_API/cvms/provision" \
  -d "$(jq -n --arg compose "$DOCKER_COMPOSE" --arg name "$CVM_NAME" '{
    name: $name,
    compose_file: {
      docker_compose_file: $compose,
      name: "",
      public_logs: true,
      public_sysinfo: true,
      gateway_enabled: true
    },
    vcpu: 1,
    memory: 2048,
    disk_size: 20,
    instance_type: "tdx.small"
  }')")

APP_ID=$(echo "$PROVISION" | jq -r '.app_id')
COMPOSE_HASH=$(echo "$PROVISION" | jq -r '.compose_hash')
ENCRYPT_KEY=$(echo "$PROVISION" | jq -r '.app_env_encrypt_pubkey')

echo "   app_id: $APP_ID"
echo "   compose_hash: $COMPOSE_HASH"

# --- Step 2: Commit CVM ---
echo "🏗️  Committing CVM..."
DEPLOY=$(curl -sf -X POST -H "X-API-Key: $PHALA_KEY" -H "Content-Type: application/json" \
  "$PHALA_API/cvms" \
  -d "$(jq -n \
    --arg appid "$APP_ID" \
    --arg hash "$COMPOSE_HASH" \
    '{
      app_id: $appid,
      compose_hash: $hash
    }')")

CVM_ID=$(echo "$DEPLOY" | jq -r '.id')
echo "   CVM ID: $CVM_ID"
echo "   Status: $(echo "$DEPLOY" | jq -r '.status')"

# --- Step 3: Wait for running ---
echo "⏳ Waiting for CVM to start..."
for i in $(seq 1 120); do
  STATUS=$(curl -sf -H "X-API-Key: $PHALA_KEY" "$PHALA_API/cvms/$CVM_ID" | jq -r '.status')
  if [[ "$STATUS" == "running" ]]; then
    echo "   ✅ CVM is running!"
    break
  elif [[ "$STATUS" == "failed" || "$STATUS" == "error" ]]; then
    echo "   ❌ CVM failed: $STATUS"
    curl -sf -X DELETE -H "X-API-Key: $PHALA_KEY" "$PHALA_API/cvms/$CVM_ID" > /dev/null 2>&1 || true
    exit 1
  fi
  printf "   %d/120 status=%s\r" "$i" "$STATUS"
  sleep 5
done

if [[ "$STATUS" != "running" ]]; then
  echo "   ❌ Timed out waiting for CVM (last status: $STATUS)"
  curl -sf -X DELETE -H "X-API-Key: $PHALA_KEY" "$PHALA_API/cvms/$CVM_ID" > /dev/null 2>&1 || true
  exit 1
fi

# --- Step 4: Wait for container ---
echo "⏳ Waiting for container to start (image pull may take a few minutes)..."
for i in $(seq 1 60); do
  COMP=$(curl -sf -H "X-API-Key: $PHALA_KEY" "$PHALA_API/cvms/$CVM_ID/composition" 2>/dev/null || echo '{}')
  CONTAINERS=$(echo "$COMP" | jq -r '.containers | length // 0' 2>/dev/null || echo 0)
  if [[ "$CONTAINERS" -gt 0 ]]; then
    echo "   ✅ Container is running!"
    echo "$COMP" | jq '.containers[] | {names, state, status}'
    break
  fi
  printf "   %d/60 waiting for image pull...\r" "$i"
  sleep 10
done

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
echo "   ✅ CVM deleted."

echo ""
echo "✅ Test complete. CVM torn down."
echo "💰 Approximate cost: ~\$0.06/hr × runtime"
