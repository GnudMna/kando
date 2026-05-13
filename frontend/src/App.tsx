// アプリケーションのルートコンポーネント
// ヘッダーとメインコンテンツ（かんばんボード）を配置する
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { KanbanBoard } from "./components/KanbanBoard";

type ThemeMode = "dark" | "light";

const THEME_STORAGE_KEY = "kando-theme";

/**
 * アプリケーションのルートレイアウトを描画する。
 * @returns ルートアプリの JSX 要素
 */
function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  const isDarkMode = themeMode === "dark";

  return (
    <div className="App app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <h1 className="app-title">Kando</h1>
          </div>
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
        </div>
      </header>
      <main className="app-main">
        <KanbanBoard />
      </main>
    </div>
  );
}

export default App;
