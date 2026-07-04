#!/bin/bash
# ========================================================================
# Script Name : check-audit.sh
# Description : 本番依存関係の脆弱性を npm audit で検証する
# Usage       : ./check-audit.sh
# ========================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../common/cd-project-root.sh"

npm run check:audit
