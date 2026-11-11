#!/bin/bash
# Client bundle build: tsdown → lib/client.js（ModuleLoader CJS 包装）。
# tsdown 不在本包 node_modules 时，退到 dsh checkout 的 node_modules/.bin。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CHECKOUT="${DSH_CHECKOUT:-}"
if [ -z "$CHECKOUT" ]; then
  for candidate in "$HOME/dsh-harness" "$HOME/dsh" "$HOME/.dsh/dsh-harness" "$HOME/Git/github/deepseek-harness" "$HOME/Git/github/dsh"; do
    if [ -d "$candidate/packages" ]; then CHECKOUT="$candidate"; break; fi
  done
fi

TSDOWN="$ROOT/node_modules/.bin/tsdown"
if [ ! -x "$TSDOWN" ]; then
  TSDOWN="$CHECKOUT/node_modules/.bin/tsdown"
fi
if [ ! -x "$TSDOWN" ]; then
  echo "build-client: tsdown not found (install it or set DSH_CHECKOUT)" >&2
  exit 1
fi

echo "=== Bundling client (tsdown: $TSDOWN) ==="
"$TSDOWN" --config tsdown.config.ts
echo "=== Client bundle complete ==="
