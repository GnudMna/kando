@echo off
REM ========================================================================
REM Script Name : test.bat
REM Description : Windows用のテスト実行スクリプト
REM Usage       : test.bat
REM ========================================================================

REM カレントディレクトリをプロジェクトのルートに変更
set SCRIPT_DIR=%~dp0
call "%SCRIPT_DIR%..\common\cd-project-root.bat"

echo テストを実行しています...
echo.

REM バックエンドのテスト
echo バックエンドのテストを実行中...
call npm --prefix backend test
if errorlevel 1 (
    echo バックエンドのテストに失敗しました
    pause
    exit /b 1
)
echo.

REM フロントエンドのテスト
echo フロントエンドのテストを実行中...
call npm --prefix frontend test
if errorlevel 1 (
    echo フロントエンドのテストに失敗しました
    pause
    exit /b 1
)
echo.

echo すべてのテストが完了しました
pause
