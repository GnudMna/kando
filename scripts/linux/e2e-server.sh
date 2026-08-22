#!/bin/bash
# E2E テスト用にバックエンド・フロントエンドの開発サーバーを起動する
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../common/cd-project-root.sh"

export DATABASE_URL="${DATABASE_URL:-postgres://kando_user:kando_password@db:5432/kanban_db}"
export AUTH_SECRET="${AUTH_SECRET:-dev-only-secret-change-in-production}"
export CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:5173}"
export PORT="${PORT:-3001}"
export E2E_TEST="true"
export VITE_E2E_TEST="true"

echo "E2E: DB マイグレーションを実行しています..."
npm --prefix backend run migrate:dev

echo "E2E: 共有型パッケージをビルドしています..."
npm --workspace @kando/types run build

trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true' EXIT INT TERM

echo "E2E: バックエンドを起動しています (port ${PORT})..."
(cd backend && npm run dev) &
BACKEND_PID=$!

echo "E2E: フロントエンドを起動しています (port 5173)..."
(cd frontend && npm run dev -- --host --port 5173) &
FRONTEND_PID=$!

echo "E2E: サーバーの起動を待機しています..."
for _ in $(seq 1 90); do
  if curl -sf "http://localhost:${PORT}/api/health" >/dev/null 2>&1 \
    && curl -sf "http://localhost:5173/api/auth/status" >/dev/null 2>&1; then
    echo "E2E: サーバーが起動しました"
    wait
    exit 0
  fi
  sleep 1
done

echo "E2E: サーバーの起動がタイムアウトしました"
exit 1
