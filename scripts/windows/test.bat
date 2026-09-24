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
REM 共有型パッケージの Lint
echo 共有型パッケージの Lint を実行中...
call npm --workspace @kando/types run lint
if errorlevel 1 (
    echo 共有型パッケージの Lint に失敗しました
    pause
    exit /b 1
)
echo.

REM 共有型パッケージの型チェック
echo 共有型パッケージの型チェックを実行中...
call npm --workspace @kando/types run typecheck
if errorlevel 1 (
    echo 共有型パッケージの型チェックに失敗しました
    pause
    exit /b 1
)
echo.

REM 共有型パッケージの単体テスト
echo 共有型パッケージの単体テストを実行中...
call npm --workspace @kando/types run test
if errorlevel 1 (
    echo 共有型パッケージの単体テストに失敗しました
    pause
    exit /b 1
)
echo.

REM 共有型パッケージのカバレッジ
echo 共有型パッケージのカバレッジを実行中...
call npm --workspace @kando/types run test:coverage
if errorlevel 1 (
    echo 共有型パッケージのカバレッジチェックに失敗しました
    pause
    exit /b 1
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

REM バックエンドの単体テスト
echo バックエンドの単体テストを実行中...
call npm --prefix backend test
if errorlevel 1 (
    echo バックエンドの単体テストに失敗しました
    pause
    exit /b 1
)
echo.

REM バックエンドのルーターテスト（DB モック）
echo バックエンドのルーターテストを実行中...
call npm --prefix backend run test:router
if errorlevel 1 (
    echo バックエンドのルーターテストに失敗しました
    pause
    exit /b 1
)
echo.

REM バックエンドのカバレッジ
echo バックエンドのカバレッジを実行中...
call npm --prefix backend run test:coverage
if errorlevel 1 (
    echo バックエンドのカバレッジチェックに失敗しました
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

REM フロントエンドの単体テスト
echo フロントエンドの単体テストを実行中...
call npm --prefix frontend test
if errorlevel 1 (
    echo フロントエンドの単体テストに失敗しました
    pause
    exit /b 1
)
echo.

REM フロントエンドのカバレッジ
echo フロントエンドのカバレッジを実行中...
call npm --prefix frontend run test:coverage
if errorlevel 1 (
    echo フロントエンドのカバレッジチェックに失敗しました
    pause
    exit /b 1
)
echo.

echo すべての品質チェックが完了しました
echo E2E テストは npm run test:e2e で別途実行できます
pause
