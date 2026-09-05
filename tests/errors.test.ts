import { describe, expect, it } from "vitest";

import { ConfigError, YalpError } from "../src/errors.js";

describe("ConfigError", () => {
  it("is an instance of YalpError and Error", () => {
    const error = new ConfigError("bad name", { code: "ERR_INVALID_NAME" });
    expect(error).toBeInstanceOf(ConfigError);
    expect(error).toBeInstanceOf(YalpError);
    expect(error).toBeInstanceOf(Error);
  });

  it("carries the message and code", () => {
    const error = new ConfigError("bad name", { code: "ERR_INVALID_NAME" });
    expect(error.message).toBe("bad name");
    expect(error.code).toBe("ERR_INVALID_NAME");
  });

  it("sets name to the concrete constructor name, not the abstract base", () => {
    const error = new ConfigError("bad name", { code: "ERR_INVALID_NAME" });
    expect(error.name).toBe("ConfigError");
  });

  it("forwards ErrorOptions such as cause", () => {
    const cause = new Error("root cause");
    const error = new ConfigError("bad name", { code: "ERR_INVALID_NAME", cause });
    expect(error.cause).toBe(cause);
  });
});
