#!/bin/bash
# ========================================================================
# Script Name : test.sh
# Description : Linux用の品質チェック実行スクリプト
# Usage       : ./test.sh [--install|-i]
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

echo "品質チェック（Lint / 型チェック / テスト）を実行しています..."
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
# 共有型パッケージの単体テスト
echo "共有型パッケージの単体テストを実行中..."
npm --workspace @kando/types run test
if [ $? -ne 0 ]; then
    echo "共有型パッケージの単体テストに失敗しました"
    exit 1
fi
echo

# 共有型パッケージのカバレッジ
echo "共有型パッケージのカバレッジを実行中..."
npm --workspace @kando/types run test:coverage
if [ $? -ne 0 ]; then
    echo "共有型パッケージのカバレッジチェックに失敗しました"
    exit 1
fi
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

# バックエンドの単体テスト
echo "バックエンドの単体テストを実行中..."
npm --prefix backend test
if [ $? -ne 0 ]; then
    echo "バックエンドの単体テストに失敗しました"
    exit 1
fi
echo

# バックエンドのルーターテスト（DB モック）
echo "バックエンドのルーターテストを実行中..."
npm --prefix backend run test:router
if [ $? -ne 0 ]; then
    echo "バックエンドのルーターテストに失敗しました"
    exit 1
fi
echo

# バックエンドのカバレッジ
echo "バックエンドのカバレッジを実行中..."
npm --prefix backend run test:coverage
if [ $? -ne 0 ]; then
    echo "バックエンドのカバレッジチェックに失敗しました"
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

# フロントエンドの単体テスト
echo "フロントエンドの単体テストを実行中..."
npm --prefix frontend test
if [ $? -ne 0 ]; then
    echo "フロントエンドの単体テストに失敗しました"
    exit 1
fi
echo

# フロントエンドのカバレッジ
echo "フロントエンドのカバレッジを実行中..."
npm --prefix frontend run test:coverage
if [ $? -ne 0 ]; then
    echo "フロントエンドのカバレッジチェックに失敗しました"
    exit 1
fi
echo

echo "すべての品質チェックが完了しました"
echo "E2E テストは npm run test:e2e で別途実行できます"
