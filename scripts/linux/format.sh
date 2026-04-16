#!/bin/bash
# ========================================================================
# Script Name : format.sh
# Description : Linux用のフォーマット整形スクリプト
# Usage       : ./format.sh
# ========================================================================

# カレントディレクトリをプロジェクトのルートに変更
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../common/cd-project-root.sh"

echo "コードのフォーマットを整形しています..."
echo

# バックエンドのフォーマット整形
echo "バックエンドのフォーマット整形中..."
npm --prefix backend run lint -- --fix
if [ $? -ne 0 ]; then
    echo "バックエンドのフォーマット整形に失敗しました"
    exit 1
fi
echo

# フロントエンドのフォーマット整形
echo "フロントエンドのフォーマット整形中..."
npm --prefix frontend run lint -- --fix
if [ $? -ne 0 ]; then
    echo "フロントエンドのフォーマット整形に失敗しました"
    exit 1
fi
echo

echo "フォーマット整形が完了しました"
