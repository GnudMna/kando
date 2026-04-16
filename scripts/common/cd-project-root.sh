#!/bin/bash
# ========================================================================
# Script Name : cd-project-root.sh
# Description : プロジェクトのルートディレクトリに移動するシェルスクリプト
# Usage       : cd-project-root.sh
# ========================================================================

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# プロジェクトのルートディレクトリを計算
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# プロジェクトのルートディレクトリを環境変数にエクスポート
export PROJECT_ROOT

# プロジェクトのルートディレクトリに移動
cd "$PROJECT_ROOT"
