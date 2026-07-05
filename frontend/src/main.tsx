import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AppNavigationProvider } from "./providers/AppNavigationProvider";
import { QueryProvider } from "./providers/QueryProvider";

/**
 * 指定した root 要素へ React アプリをマウントする。
 * @param rootElement - マウント先の DOM 要素
 * @returns なし
 */
function mountApp(rootElement: HTMLElement): void {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryProvider>
        <AppNavigationProvider>
          <App />
        </AppNavigationProvider>
      </QueryProvider>
    </StrictMode>,
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element '#root' was not found");
}

mountApp(rootElement);
