#!/bin/bash
# ========================================================================
# Script Name : test.sh
# Description : Linux用の品質チェック実行スクリプト
# Usage       : ./test.sh
# ========================================================================

# カレントディレクトリをプロジェクトのルートに変更
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../common/cd-project-root.sh"

echo "品質チェック（Lint / 型チェック / テスト）を実行しています..."
echo

# バックエンドの Lint
echo "バックエンドの Lint を実行中..."
npm --prefix backend run lint
if [ $? -ne 0 ]; then
    echo "バックエンドの Lint に失敗しました"
    exit 1
fi
echo

# バックエンドの型チェック
echo "バックエンドの型チェックを実行中..."
npm --prefix backend run typecheck
if [ $? -ne 0 ]; then
    echo "バックエンドの型チェックに失敗しました"
    exit 1
fi
echo

# バックエンドのテスト
echo "バックエンドのテストを実行中..."
npm --prefix backend test
if [ $? -ne 0 ]; then
    echo "バックエンドのテストに失敗しました"
    exit 1
fi
echo

# フロントエンドの Lint
echo "フロントエンドの Lint を実行中..."
npm --prefix frontend run lint
if [ $? -ne 0 ]; then
    echo "フロントエンドの Lint に失敗しました"
    exit 1
fi
echo

# フロントエンドの型チェック
echo "フロントエンドの型チェックを実行中..."
npm --prefix frontend run typecheck
if [ $? -ne 0 ]; then
    echo "フロントエンドの型チェックに失敗しました"
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

echo "すべての品質チェックが完了しました"
