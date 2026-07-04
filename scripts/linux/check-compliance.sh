#!/bin/bash
# ========================================================================
# Script Name : check-compliance.sh
# Description : ライセンスと脆弱性のコンプライアンスチェックを実行する
# Usage       : ./check-compliance.sh
# ========================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../common/cd-project-root.sh"

npm run check:compliance
