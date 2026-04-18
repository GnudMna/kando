#!/bin/bash
# ========================================================================
# Script Name : dev.sh
# Description : Linux用の開発モード実行スクリプト
# Usage       : ./dev.sh
# ========================================================================

# カレントディレクトリをプロジェクトのルートに変更
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../common/cd-project-root.sh"

echo "Kandoを開発モードで起動します..."
echo

# 依存関係をインストール
if [ ! -d "backend/node_modules" ]; then
    echo "バックエンドの依存関係をインストールしています..."
    npm install --prefix backend
    if [ $? -ne 0 ]; then
        echo "バックエンドの依存関係のインストールに失敗しました"
        exit 1
    fi
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "フロントエンドの依存関係をインストールしています..."
    npm install --prefix frontend
    if [ $? -ne 0 ]; then
        echo "フロントエンドの依存関係のインストールに失敗しました"
        exit 1
    fi
fi
echo

# バックエンドの DB マイグレーションを実行
echo "バックエンドの DB マイグレーションを実行しています..."
npm --prefix backend run migrate:dev
if [ $? -ne 0 ]; then
    echo "バックエンドの DB マイグレーションに失敗しました"
    exit 1
fi
echo

# 終了時に子プロセスを終了する
trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit' INT TERM

# バックエンドを開発モードで起動
echo "バックエンドAPIを起動しています (Port 3001)..."
(cd backend && npm run dev) &
BACKEND_PID=$!

# フロントエンドを開発モードで起動
echo "フロントエンドViteを起動しています (Port 5173)..."
(cd frontend && npm run dev -- --host) &
FRONTEND_PID=$!

echo
echo "開発サーバーが起動しました。終了するには Ctrl+C を押してください。"
wait
