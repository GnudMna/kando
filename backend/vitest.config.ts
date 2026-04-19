export default {
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage/backend",
      statements: 60,
      branches: 60,
      functions: 60,
      lines: 60,
      exclude: [
        "**/dist/**",
        "**/node_modules/**",
        "tests/**/*.integration.test.ts",
      ],
    },
  },
};
