#!/bin/bash
# ========================================================================
# Script Name : db-backup.sh
# Description : Creates a logical PostgreSQL backup from the running db service
# Usage       : ./db-backup.sh
# ========================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../common/cd-project-root.sh"

if ! docker compose ps --status running --services db | grep -q '^db$'; then
    echo "The db service is not running. Start it with: docker compose up -d db"
    exit 1
fi

POSTGRES_USER="${POSTGRES_USER:-kando_user}"
POSTGRES_DB="${POSTGRES_DB:-kanban_db}"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/kanban_db-${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "Creating backup at: $BACKUP_FILE"
if ! docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$BACKUP_FILE"; then
    rm -f "$BACKUP_FILE"
    echo "Backup failed."
    exit 1
fi

echo "Backup completed: $BACKUP_FILE"
