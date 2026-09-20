import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    typecheck: {
      enabled: true,
      include: ["tests/**/*.test-d.ts"],
      // The root tsconfig only includes src; a type test outside the program would pass unchecked.
      tsconfig: "./tsconfig.test.json",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Barrel file: re-exports only, nothing to execute.
      exclude: ["src/index.ts"],
      reporter: ["text", "html"],
      thresholds: {
        lines: 99,
        statements: 99,
        functions: 99,
        branches: 99,
      },
    },
  },
});
