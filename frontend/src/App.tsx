import { useEffect, useState } from "react";
import { Moon, Sun, NotebookPen } from "lucide-react";
import { KanbanBoard } from "./components/KanbanBoard";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoginScreen } from "./components/LoginScreen";
import { MemoPanel } from "./components/MemoPanel";
import { useAuth } from "./hooks/useAuth";
import { useAppNavigation } from "./providers/useAppNavigation";

type ThemeMode = "dark" | "light";

const THEME_STORAGE_KEY = "kando-theme";

/**
 * アプリケーションのルートレイアウトを描画する。
 * @returns ルートアプリの JSX 要素
 */
function App() {
  const { status, login, register, logout, error, clearError } = useAuth();

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "dark";
  });

  const { memoOpen, setMemoOpen, closeMemo } = useAppNavigation();

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  const isDarkMode = themeMode === "dark";

  // 認証確認中はスピナーなしで待機(チラつき防止)
  if (status === "checking") {
    return null;
  }

  // ユーザー未登録の場合は登録画面を表示(初回セットアップ)
  if (status === "unregistered") {
    return (
      <LoginScreen
        initialMode="register"
        onLogin={login}
        onRegister={register}
        error={error}
        onClearError={clearError}
      />
    );
  }

  // 未ログインの場合はログイン画面を表示
  if (status === "unauthenticated") {
    return (
      <LoginScreen
        onLogin={login}
        onRegister={register}
        error={error}
        onClearError={clearError}
      />
    );
  }

  return (
    <div className="App app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <img
              src="/favicon.svg"
              alt=""
              className="app-logo"
              aria-hidden="true"
            />
            <h1 className="app-title">Kando</h1>
          </div>
          <div className="app-header-right">
            <button
              type="button"
              className="btn theme-toggle"
              onClick={() =>
                setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))
              }
              aria-label={
                isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"
              }
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              {isDarkMode ? "ライトモード" : "ダークモード"}
            </button>
            {status === "authenticated" && (
              <button
                type="button"
                className="btn theme-toggle"
                onClick={() => setMemoOpen((prev) => !prev)}
                aria-label="メモ帳を開く"
                aria-expanded={memoOpen}
              >
                <NotebookPen size={16} />
                メモ帳
              </button>
            )}
            {status === "authenticated" && (
              <button
                type="button"
                className="btn theme-toggle"
                onClick={logout}
                aria-label="ログアウト"
              >
                ログアウト
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="app-main">
        <ErrorBoundary>
          <KanbanBoard />
        </ErrorBoundary>
      </main>
      {memoOpen && status === "authenticated" && (
        <MemoPanel onClose={closeMemo} />
      )}
    </div>
  );
}

export default App;
