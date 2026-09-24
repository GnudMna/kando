#!/bin/bash
# ========================================================================
# Script Name : format.sh
# Description : Linux用の ESLint 自動修正スクリプト
# Usage       : ./format.sh [--install|-i]
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

echo "ESLint の自動修正と Prettier によるコード整形を実行しています..."
echo

# 依存関係をインストール（--install / -i オプション指定時のみ）
if [ "$INSTALL" = true ]; then
    echo "ワークスペースの依存関係をインストールしています..."
    npm ci
    if [ $? -ne 0 ]; then
        echo "依存関係のインストールに失敗しました"
        exit 1
    fi
fi

echo
# 共有型パッケージの ESLint 自動修正
echo "共有型パッケージの ESLint 自動修正を実行中..."
npm --workspace @kando/types run lint:fix
if [ $? -ne 0 ]; then
    echo "共有型パッケージの ESLint 自動修正に失敗しました"
    exit 1
fi
echo

# バックエンドの ESLint 自動修正
echo "バックエンドの ESLint 自動修正を実行中..."
npm --prefix backend run lint:fix
if [ $? -ne 0 ]; then
    echo "バックエンドの ESLint 自動修正に失敗しました"
    exit 1
fi
echo

# フロントエンドの ESLint 自動修正
echo "フロントエンドの ESLint 自動修正を実行中..."
npm --prefix frontend run lint:fix
if [ $? -ne 0 ]; then
    echo "フロントエンドの ESLint 自動修正に失敗しました"
    exit 1
fi
echo

# バックエンドの Prettier によるコード整形
echo "バックエンドの Prettier によるコード整形を実行中..."
npm --prefix backend run format
if [ $? -ne 0 ]; then
    echo "バックエンドの Prettier によるコード整形に失敗しました"
    exit 1
fi
echo

# フロントエンドの Prettier によるコード整形
echo "フロントエンドの Prettier によるコード整形を実行中..."
npm --prefix frontend run format
if [ $? -ne 0 ]; then
    echo "フロントエンドの Prettier によるコード整形に失敗しました"
    exit 1
fi

echo
# 共有型パッケージの Prettier によるコード整形
echo "共有型パッケージの Prettier によるコード整形を実行中..."
npm --prefix packages/types run format
if [ $? -ne 0 ]; then
    echo "共有型パッケージの Prettier によるコード整形に失敗しました"
    exit 1
fi
echo

echo "ESLint 自動修正と Prettier によるコード整形が完了しました"
