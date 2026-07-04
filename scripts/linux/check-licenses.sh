#!/bin/bash
# ========================================================================
# Script Name : check-licenses.sh
# Description : 本番依存関係のライセンスを licensee で検証する
# Usage       : ./check-licenses.sh
# ========================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../common/cd-project-root.sh"

npm run check:licenses
