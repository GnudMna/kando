import { defineConfig } from "vitest/config";

/**
 * バックエンドの統合テスト向け Vitest 設定を生成する。
 * @returns Vitest 設定オブジェクト
 */
function createIntegrationVitestConfig() {
  return defineConfig({
    test: {
      globals: true,
      environment: "node",
      include: ["tests/**/*.integration.test.ts"],
    },
  });
}

export default createIntegrationVitestConfig();
