@echo off
REM ========================================================================
REM Script Name : check-audit.bat
REM Description : 本番依存関係の脆弱性を npm audit で検証する
REM Usage       : check-audit.bat
REM ========================================================================

set SCRIPT_DIR=%~dp0
call "%SCRIPT_DIR%..\common\cd-project-root.bat"

call npm run check:audit
if errorlevel 1 (
    exit /b 1
)
