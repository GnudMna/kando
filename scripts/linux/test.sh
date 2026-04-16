#!/bin/bash
# ========================================================================
# Script Name : test.sh
# Description : Linux用のテスト実行スクリプト
# Usage       : ./test.sh
# ========================================================================

# カレントディレクトリをプロジェクトのルートに変更
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../common/cd-project-root.sh"

echo "テストを実行しています..."
echo

# バックエンドのテスト
echo "バックエンドのテストを実行中..."
npm --prefix backend test
if [ $? -ne 0 ]; then
    echo "バックエンドのテストに失敗しました"
    exit 1
fi
echo

# フロントエンドのテスト
echo "フロントエンドのテストを実行中..."
npm --prefix frontend test
if [ $? -ne 0 ]; then
    echo "フロントエンドのテストに失敗しました"
    exit 1
fi
echo

echo "すべてのテストが完了しました"
