@echo off
REM ========================================================================
REM Script Name : db-backup.bat
REM Description : Creates a logical PostgreSQL backup from the running db service
REM Usage       : db-backup.bat
REM ========================================================================

setlocal EnableDelayedExpansion

set SCRIPT_DIR=%~dp0
call "%SCRIPT_DIR%..\common\cd-project-root.bat"

for /f %%I in ('docker compose ps --status running --services db ^| findstr /r "^db$"') do set DB_RUNNING=%%I
if not "%DB_RUNNING%"=="db" (
    echo The db service is not running. Start it with: docker compose up -d db
    pause
    exit /b 1
)

if "%POSTGRES_USER%"=="" set POSTGRES_USER=kando_user
if "%POSTGRES_DB%"=="" set POSTGRES_DB=kanban_db

if not exist backups mkdir backups
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set TIMESTAMP=%%I
set BACKUP_FILE=backups\kanban_db-!TIMESTAMP!.sql

echo Creating backup at: !BACKUP_FILE!
docker compose exec -T db pg_dump -U %POSTGRES_USER% -d %POSTGRES_DB% > "!BACKUP_FILE!"
if errorlevel 1 (
    echo Backup failed.
    if exist "!BACKUP_FILE!" del /q "!BACKUP_FILE!"
    pause
    exit /b 1
)

echo Backup completed: !BACKUP_FILE!
pause
