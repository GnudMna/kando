@echo off
REM ========================================================================
REM Script Name : db-restore.bat
REM Description : Restores a logical PostgreSQL backup into the running db service
REM Usage       : db-restore.bat <backup-file.sql> [--yes]
REM ========================================================================

setlocal EnableDelayedExpansion

set SCRIPT_DIR=%~dp0
call "%SCRIPT_DIR%..\common\cd-project-root.bat"

if "%~1"=="" (
    echo Usage: %~nx0 ^<backup-file.sql^> [--yes]
    pause
    exit /b 1
)

set BACKUP_FILE=%~1
if not exist "%BACKUP_FILE%" (
    echo Backup file not found: %BACKUP_FILE%
    pause
    exit /b 1
)

for /f %%I in ('docker compose ps --status running --services db ^| findstr /r "^db$"') do set DB_RUNNING=%%I
if not "%DB_RUNNING%"=="db" (
    echo The db service is not running. Start it with: docker compose up -d db
    pause
    exit /b 1
)

if "%POSTGRES_USER%"=="" set POSTGRES_USER=kando_user
if "%POSTGRES_DB%"=="" set POSTGRES_DB=kanban_db

if /I not "%~2"=="--yes" (
    echo This operation will erase current database contents before restore.
    choice /C YN /M "Continue"
    if errorlevel 2 (
        echo Restore canceled.
        pause
        exit /b 0
    )
)

echo Resetting schema...
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U %POSTGRES_USER% -d %POSTGRES_DB% -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
if errorlevel 1 (
    echo Failed to reset schema.
    pause
    exit /b 1
)

echo Restoring from: %BACKUP_FILE%
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U %POSTGRES_USER% -d %POSTGRES_DB% < "%BACKUP_FILE%"
if errorlevel 1 (
    echo Restore failed.
    pause
    exit /b 1
)

echo Restore completed.
pause
