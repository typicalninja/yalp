import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  publint: true,
  attw: {
    ignoreRules: ["cjs-resolves-to-esm"],
  },
});
