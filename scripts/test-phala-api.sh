#!/bin/bash
# Test the two-phase Phala API flow (provision only — does NOT commit/start)
# This verifies our API format is correct without spending money.

set -e

PHALA_KEY=$(cat ~/.config/phala/api_key)
API="https://cloud-api.phala.network/api/v1"

echo "=== Testing Phala API (provision only) ==="

# Phase 1: Provision
echo "→ Phase 1: Provisioning..."
PROVISION=$(curl -s -X POST "$API/cvms/provision" \
  -H "X-API-Key: $PHALA_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "api-test-'$(date +%s)'",
    "vcpu": 1,
    "memory": 2048,
    "disk_size": 20,
    "instance_type": "tdx.small",
    "compose_file": {
      "docker_compose_file": "services:\n  test:\n    image: alpine\n    command: sleep 3600",
      "name": "",
      "public_logs": true,
      "public_sysinfo": true,
      "gateway_enabled": true
    }
  }')

echo "$PROVISION" | jq .

APP_ID=$(echo "$PROVISION" | jq -r '.app_id')
PUBKEY=$(echo "$PROVISION" | jq -r '.app_env_encrypt_pubkey')
HASH=$(echo "$PROVISION" | jq -r '.compose_hash')

if [ "$APP_ID" = "null" ] || [ -z "$APP_ID" ]; then
  echo "✗ Provision failed"
  exit 1
fi

echo ""
echo "✓ Provision OK"
echo "  app_id: $APP_ID"
echo "  pubkey: $PUBKEY"
echo "  hash:   $HASH"
echo ""
echo "→ NOT committing (would start CVM and cost money)"
echo "→ To commit: curl -X POST $API/cvms -d '{\"app_id\": \"$APP_ID\", \"compose_hash\": \"$HASH\"}'"
echo ""
echo "=== Test passed ==="
