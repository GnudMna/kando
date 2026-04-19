import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
