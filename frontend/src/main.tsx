import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

/**
 * 指定した root 要素へ React アプリをマウントする。
 * @param rootElement - マウント先の DOM 要素
 * @returns なし
 */
function mountApp(rootElement: HTMLElement): void {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element '#root' was not found");
}

mountApp(rootElement);
