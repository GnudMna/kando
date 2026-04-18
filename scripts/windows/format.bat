@echo off
REM ========================================================================
REM Script Name : format.bat
REM Description : Windows用の ESLint 自動修正スクリプト
REM Usage       : format.bat
REM ========================================================================

REM カレントディレクトリをプロジェクトのルートに変更
set SCRIPT_DIR=%~dp0
call "%SCRIPT_DIR%..\common\cd-project-root.bat"

echo ESLint の自動修正と Prettier によるコード整形を実行しています...
echo.

REM バックエンドの ESLint 自動修正
echo バックエンドの ESLint 自動修正を実行中...
call npm --prefix backend run lint:fix
if errorlevel 1 (
    echo バックエンドの ESLint 自動修正に失敗しました
    pause
    exit /b 1
)
echo.

REM フロントエンドの ESLint 自動修正
echo フロントエンドの ESLint 自動修正を実行中...
call npm --prefix frontend run lint:fix
if errorlevel 1 (
    echo フロントエンドの ESLint 自動修正に失敗しました
    pause
    exit /b 1
)
echo.

REM バックエンドの Prettier によるコード整形
echo バックエンドの Prettier によるコード整形を実行中...
call npm --prefix backend run format
if errorlevel 1 (
    echo バックエンドの Prettier によるコード整形に失敗しました
    pause
    exit /b 1
)
echo.

REM フロントエンドの Prettier によるコード整形
echo フロントエンドの Prettier によるコード整形を実行中...
call npm --prefix frontend run format
if errorlevel 1 (
    echo フロントエンドの Prettier によるコード整形に失敗しました
    pause
    exit /b 1
)
echo.

echo ESLint 自動修正と Prettier によるコード整形が完了しました
pause
