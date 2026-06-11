/**
 * Vite / Vitest 設定。
 * React プラグイン、テスト環境、本番ビルドのチャンク分割を定義する。
 */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          // react は react-dom と区別して "react" パッケージだけを厳密に判定する
          const isReactPackage = /node_modules\/react(?:\/|$)/.test(
            normalizedId,
          );
          if (!normalizedId.includes("node_modules")) return;
          if (normalizedId.includes("@hello-pangea/dnd")) return "dnd";
          if (normalizedId.includes("lucide-react")) return "lucide";
          if (normalizedId.includes("react-dom") || isReactPackage) {
            return "react";
          }
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage/frontend",
      thresholds: {
        statements: 60,
        branches: 55,
        functions: 57,
        lines: 60,
      },
      exclude: [
        "**/dist/**",
        "**/node_modules/**",
        "src/main.tsx",
        "src/App.tsx",
        "src/components/LoginScreen.tsx",
        "src/components/ListView.tsx",
        "src/components/MemoPanel.tsx",
        "src/components/ErrorBoundary.tsx",
        "src/components/CommentSection.tsx",
        "src/hooks/useAuth.ts",
      ],
    },
  },
});
