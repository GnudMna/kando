@echo off
REM ========================================================================
REM Script Name : test.bat
REM Description : Windows用の品質チェック実行スクリプト
REM Usage       : test.bat
REM ========================================================================

REM カレントディレクトリをプロジェクトのルートに変更
set SCRIPT_DIR=%~dp0
call "%SCRIPT_DIR%..\common\cd-project-root.bat"

echo 品質チェック（Lint / 型チェック / テスト）を実行しています...
echo.

REM バックエンドの Lint
echo バックエンドの Lint を実行中...
call npm --prefix backend run lint
if errorlevel 1 (
    echo バックエンドの Lint に失敗しました
    pause
    exit /b 1
)
echo.

REM バックエンドの型チェック
echo バックエンドの型チェックを実行中...
call npm --prefix backend run typecheck
if errorlevel 1 (
    echo バックエンドの型チェックに失敗しました
    pause
    exit /b 1
)
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

REM フロントエンドの Lint
echo フロントエンドの Lint を実行中...
call npm --prefix frontend run lint
if errorlevel 1 (
    echo フロントエンドの Lint に失敗しました
    pause
    exit /b 1
)
echo.

REM フロントエンドの型チェック
echo フロントエンドの型チェックを実行中...
call npm --prefix frontend run typecheck
if errorlevel 1 (
    echo フロントエンドの型チェックに失敗しました
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

echo すべての品質チェックが完了しました
pause
