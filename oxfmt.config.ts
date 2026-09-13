import { defineConfig } from "oxfmt";

export default defineConfig({
  sortImports: true,
  jsdoc: true,
  ignorePatterns: ["dist/**", "jsr.jsonc"],
});
