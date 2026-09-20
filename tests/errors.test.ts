import { describe, expect, it } from "vitest";

import { ConfigError, YalpError } from "../src/errors.js";

describe("ConfigError", () => {
  it("is a YalpError carrying its message, code, cause, and concrete class name", () => {
    const cause = new Error("root cause");
    const error = new ConfigError("bad name", { code: "ERR_INVALID_NAME", cause });

    expect(error).toBeInstanceOf(YalpError);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      message: "bad name",
      code: "ERR_INVALID_NAME",
      name: "ConfigError",
      cause,
    });
  });
});
