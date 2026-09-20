import { describe, expect, it } from "vitest";

import * as api from "../src/index.js";

describe("public entry point", () => {
  it("exports only the documented runtime values", () => {
    expect(Object.keys(api).sort()).toEqual([
      "ConfigError",
      "YalpError",
      "defineCommand",
      "parse",
      "run",
    ]);
  });
});
