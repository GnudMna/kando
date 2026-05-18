@echo off
REM ========================================================================
REM Script Name : test.bat
REM Description : Windows用の品質チェック実行スクリプト
REM Usage       : test.bat [--install|-i]
REM ========================================================================

REM カレントディレクトリをプロジェクトのルートに変更
set SCRIPT_DIR=%~dp0
call "%SCRIPT_DIR%..\common\cd-project-root.bat"

REM 引数を解析
set INSTALL=false
if "%~1"=="--install" set INSTALL=true
if "%~1"=="-i" set INSTALL=true
echo 品質チェック（Lint / 型チェック / テスト）を実行しています...
echo.

REM 依存関係をインストール（--install / -i オプション指定時のみ）
if "%INSTALL%"=="true" (
    echo ワークスペースの依存関係をインストールしています...
    call npm ci
    if errorlevel 1 (
        echo 依存関係のインストールに失敗しました
        pause
        exit /b 1
    )
)

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
