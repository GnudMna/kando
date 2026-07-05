/** @kando/types 向け Vitest 設定。 */
export default {
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage/types",
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      },
      exclude: ["**/dist/**", "**/node_modules/**"],
    },
  },
};
