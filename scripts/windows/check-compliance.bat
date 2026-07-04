@echo off
REM ========================================================================
REM Script Name : check-compliance.bat
REM Description : ライセンスと脆弱性のコンプライアンスチェックを実行する
REM Usage       : check-compliance.bat
REM ========================================================================

set SCRIPT_DIR=%~dp0
call "%SCRIPT_DIR%..\common\cd-project-root.bat"

call npm run check:compliance
if errorlevel 1 (
    exit /b 1
)
