import { defineConfig } from "vitest/config";

/**
 * バックエンドのユニットテスト向け Vitest 設定を生成する。
 * @returns Vitest 設定オブジェクト
 */
function createUnitVitestConfig() {
  return defineConfig({
    test: {
      globals: true,
      environment: "node",
      include: ["tests/**/*.test.ts"],
    },
  });
}

export default createUnitVitestConfig();
