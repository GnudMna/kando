@echo off
REM ========================================================================
REM Script Name : dev.bat
REM Description : Windows用の開発モード実行スクリプト
REM Usage       : dev.bat [--install|-i]
REM ========================================================================

REM カレントディレクトリをプロジェクトのルートに変更
set SCRIPT_DIR=%~dp0
call "%SCRIPT_DIR%..\common\cd-project-root.bat"

REM 引数を解析
set INSTALL=false
if "%~1"=="--install" set INSTALL=true
if "%~1"=="-i" set INSTALL=true
echo Kandoを開発モードで起動します...
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
    echo.
)

REM バックエンドの DB マイグレーションを実行
echo バックエンドの DB マイグレーションを実行しています...
call npm --prefix backend run migrate:dev
if errorlevel 1 (
    echo バックエンドの DB マイグレーションに失敗しました
    pause
    exit /b 1
)
echo.

REM バックエンドを開発モードで起動
echo バックエンドAPIを起動しています (Port 3001)...
start "Kando Backend" cmd /k "cd /d %PROJECT_ROOT%\backend && npm run dev"

REM フロントエンドを開発モードで起動
echo フロントエンドViteを起動しています (Port 5173)...
start "Kando Frontend" cmd /k "cd /d %PROJECT_ROOT%\frontend && npm run dev -- --host"

echo.
echo 開発サーバーが起動しました。各ウィンドウを閉じるとサーバーが終了します。
