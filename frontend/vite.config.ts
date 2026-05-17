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
        branches: 60,
        functions: 60,
        lines: 60,
      },
      exclude: ["**/dist/**", "**/node_modules/**"],
    },
  },
});
