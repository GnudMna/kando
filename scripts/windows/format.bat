@echo off
REM ========================================================================
REM Script Name : format.bat
REM Description : Windows用のフォーマット整形スクリプト
REM Usage       : format.bat
REM ========================================================================

REM カレントディレクトリをプロジェクトのルートに変更
set SCRIPT_DIR=%~dp0
call "%SCRIPT_DIR%..\common\cd-project-root.bat"

echo コードのフォーマットを整形しています...
echo.

REM バックエンドのフォーマット整形
echo バックエンドのフォーマット整形中...
call npm --prefix backend run lint -- --fix
if errorlevel 1 (
    echo バックエンドのフォーマット整形に失敗しました
    pause
    exit /b 1
)
echo.

REM フロントエンドのフォーマット整形
echo フロントエンドのフォーマット整形中...
call npm --prefix frontend run lint -- --fix
if errorlevel 1 (
    echo フロントエンドのフォーマット整形に失敗しました
    pause
    exit /b 1
)
echo.

echo フォーマット整形が完了しました
pause
