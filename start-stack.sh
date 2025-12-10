#!/usr/bin/env bash

# Run the full local stack: Hardhat node + contract deploy + server + client.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$ROOT_DIR/smart-contracts"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"
LOG_DIR="$ROOT_DIR/.logs"

HARDHAT_PID=""
SERVER_PID=""

mkdir -p "$LOG_DIR"

cleanup() {
  echo
  echo "🧹  Cleaning up background services..."
  [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2>/dev/null || true
  [[ -n "$HARDHAT_PID" ]] && kill "$HARDHAT_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "🛑  1) Stopping any services on ports 8545/3000/3001..."
npx kill-port 8545 3000 3001 >/dev/null 2>&1 || true
echo "✅  Ports cleared."

echo "------------------------------------------------"

echo "⛓️  2) Starting local Hardhat blockchain..."
cd "$CONTRACTS_DIR"
npx hardhat node >"$LOG_DIR/hardhat.log" 2>&1 &
HARDHAT_PID=$!
echo "✅  Hardhat node started (PID: $HARDHAT_PID). Logs: $LOG_DIR/hardhat.log"

echo "⏳  Waiting 5 seconds for Hardhat to be ready..."
sleep 5

echo "------------------------------------------------"

echo "🚀  3) Deploying smart contracts to localhost..."
if npx hardhat run scripts/deploy.ts --network localhost; then
  echo "✅  Contracts deployed successfully."
else
  echo "❌  Deployment failed. Stopping..."
  exit 1
fi

echo "------------------------------------------------"

echo "🖥️  4) Starting backend server..."
cd "$SERVER_DIR"
npm run dev >"$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!
echo "✅  Server running (PID: $SERVER_PID). Logs: $LOG_DIR/server.log"

echo "------------------------------------------------"

echo "💻  5) Starting frontend (foreground)..."
cd "$CLIENT_DIR"
npm run dev

echo "Frontend stopped. Stack shutdown complete."

