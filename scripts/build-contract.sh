#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
while pgrep -x cargo >/dev/null; do echo 'Waiting for the other Cargo build'; sleep 15; done
if command -v memory_pressure >/dev/null; then
  while [ "$(memory_pressure | tail -1 | tr -cd '0-9')" -lt 30 ]; do echo 'Waiting for memory'; sleep 15; done
fi
(cd packages/contract/account && cargo near build non-reproducible-wasm --no-abi --locked)
cp packages/contract/account/target/near/tong_account.wasm packages/contract/res/tong_account.wasm
while pgrep -x cargo >/dev/null; do sleep 5; done
(cd packages/contract && cargo near build non-reproducible-wasm --no-abi --locked)
