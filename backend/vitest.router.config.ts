import { defineConfig } from "vitest/config";

/**
 * バックエンドのルーターテスト向け Vitest 設定を生成する。
 * DB はモックし、HTTP ルーターとミドルウェアの結合を検証する。
 * @returns Vitest 設定オブジェクト
 */
function createRouterVitestConfig() {
  return defineConfig({
    test: {
      globals: true,
      environment: "node",
      include: ["tests/**/*.router.test.ts"],
    },
  });
}

export default createRouterVitestConfig();
