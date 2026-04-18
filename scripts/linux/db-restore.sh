#!/bin/bash
# ========================================================================
# Script Name : db-restore.sh
# Description : Restores a logical PostgreSQL backup into the running db service
# Usage       : ./db-restore.sh <backup-file.sql> [--yes]
# ========================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../common/cd-project-root.sh"

if [[ $# -lt 1 || $# -gt 2 ]]; then
    echo "Usage: $0 <backup-file.sql> [--yes]"
    exit 1
fi

BACKUP_FILE="$1"
ASSUME_YES="${2:-}"

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

if ! docker compose ps --status running --services db | grep -q '^db$'; then
    echo "The db service is not running. Start it with: docker compose up -d db"
    exit 1
fi

if [[ "$ASSUME_YES" != "--yes" ]]; then
    echo "This operation will erase current database contents before restore."
    read -r -p "Type YES to continue: " CONFIRM
    if [[ "$CONFIRM" != "YES" ]]; then
        echo "Restore canceled."
        exit 0
    fi
fi

POSTGRES_USER="${POSTGRES_USER:-kando_user}"
POSTGRES_DB="${POSTGRES_DB:-kanban_db}"

echo "Resetting schema..."
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "Restoring from: $BACKUP_FILE"
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$BACKUP_FILE"

echo "Restore completed."
