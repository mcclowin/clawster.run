#!/bin/bash
# Quick Phala API test — run from clawster root
# Usage: PHALA_API_KEY=phak_xxx ./test-phala.sh

KEY="${PHALA_API_KEY:-$(grep PHALA_API_KEY .env.local 2>/dev/null | cut -d= -f2)}"

if [ -z "$KEY" ]; then
  echo "No PHALA_API_KEY found"
  exit 1
fi

echo "Testing Phala API with key: ${KEY:0:10}..."
echo ""

# Test 1: List CVMs (simplest call)
echo "=== List CVMs ==="
curl -s -w "\nHTTP %{http_code}\n" \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  "https://cloud-api.phala.network/api/v1/cvms"

echo ""
echo "=== Done ==="
