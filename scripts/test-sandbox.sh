#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v memory_pressure >/dev/null; then
  while [ "$(memory_pressure | tail -1 | tr -cd '0-9')" -lt 30 ]; do echo 'Waiting for memory'; sleep 15; done
fi
VERSION=2.14.0-rc.4
BIN="${NEAR_SANDBOX_BIN:-$PWD/.tools/near-sandbox}"
if [ ! -x "$BIN" ]; then
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) PLATFORM=Darwin-arm64 ;;
    Linux-x86_64) PLATFORM=Linux-x86_64 ;;
    Linux-aarch64) PLATFORM=Linux-aarch64 ;;
    *) echo 'Set NEAR_SANDBOX_BIN to your sandbox binary'; exit 1 ;;
  esac
  mkdir -p .tools
  curl -fsSL "https://s3-us-west-1.amazonaws.com/build.nearprotocol.com/nearcore/$PLATFORM/$VERSION/near-sandbox.tar.gz" | tar -xz -C .tools --strip-components=1
fi
STATE=$(mktemp -d /tmp/tong-sandbox.XXXXXX)
"$BIN" --home "$STATE" init > "$STATE/init.log" 2>&1
"$BIN" --home "$STATE" run --rpc-addr 127.0.0.1:5380 --network-addr 127.0.0.1:5381 > "$STATE/node.log" 2>&1 &
SANDBOX_PID=$!
trap 'kill "$SANDBOX_PID" 2>/dev/null || true; wait "$SANDBOX_PID" 2>/dev/null || true; rm -rf "$STATE"' EXIT
for _ in $(seq 60); do curl -fs http://127.0.0.1:5380/status >/dev/null 2>&1 && break; sleep 0.5; done
TONG_SANDBOX_KEY_FILE="$STATE/validator_key.json" TONG_SANDBOX_RPC=http://127.0.0.1:5380 node --test --test-concurrency=1 tests/sandbox.mjs
