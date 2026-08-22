#!/bin/bash
# ========================================================================
# Script Name : dev.sh
# Description : Linux用の開発モード実行スクリプト
# Usage       : ./dev.sh [--install|-i]
# ========================================================================

# カレントディレクトリをプロジェクトのルートに変更
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../common/cd-project-root.sh"

# 引数を解析
INSTALL=false
for arg in "$@"; do
    case $arg in
        --install|-i)
            INSTALL=true
            ;;
    esac
done

echo "Kandoを開発モードで起動します..."
echo

# 依存関係をインストール（--install / -i オプション指定時のみ）
if [ "$INSTALL" = true ]; then
    echo "ワークスペースの依存関係をインストールしています..."
    npm ci
    if [ $? -ne 0 ]; then
        echo "依存関係のインストールに失敗しました"
        exit 1
    fi
    echo
fi

# バックエンドの DB マイグレーションを実行
echo "バックエンドの DB マイグレーションを実行しています..."
npm --prefix backend run migrate:dev
if [ $? -ne 0 ]; then
    echo "バックエンドの DB マイグレーションに失敗しました"
    exit 1
fi
echo

# Vite 8 は起動時に依存関係を走査するため、@kando/types の dist が先に必要
echo "共有型パッケージをビルドしています..."
npm --workspace @kando/types run build
if [ $? -ne 0 ]; then
    echo "共有型パッケージのビルドに失敗しました"
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
