import { describe, expect, it } from "vitest";

import { defineCommand, findOptionByShort, findSubCommand } from "../src/command.js";
import { ConfigError } from "../src/errors.js";

function configErrorCode(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof ConfigError) return error.code;
    throw error;
  }
  throw new Error("expected defineCommand to throw a ConfigError");
}

describe("defineCommand: name/alias validation", () => {
  it("accepts kebab-case names", () => {
    expect(() => defineCommand({ name: "my-cli" })).not.toThrow();
  });

  it("rejects a non-kebab-case name", () => {
    expect(configErrorCode(() => defineCommand({ name: "MyCli" }))).toBe("ERR_INVALID_NAME");
  });

  it("rejects a non-kebab-case alias", () => {
    expect(configErrorCode(() => defineCommand({ name: "cli", alias: ["Bad_Alias"] }))).toBe(
      "ERR_INVALID_NAME",
    );
  });

  it("accepts kebab-case aliases", () => {
    expect(() => defineCommand({ name: "cli", alias: ["c", "cli-alt"] })).not.toThrow();
  });
});

describe("defineCommand: option validation", () => {
  it("rejects a non-kebab-case option key", () => {
    expect(configErrorCode(() => defineCommand({ name: "cli", options: { fooBar: {} } }))).toBe(
      "ERR_INVALID_NAME",
    );
  });

  it("rejects the reserved option name 'help'", () => {
    expect(configErrorCode(() => defineCommand({ name: "cli", options: { help: {} } }))).toBe(
      "ERR_RESERVED_NAME",
    );
  });

  it("rejects the reserved option name 'version'", () => {
    expect(configErrorCode(() => defineCommand({ name: "cli", options: { version: {} } }))).toBe(
      "ERR_RESERVED_NAME",
    );
  });

  it("rejects an option name starting with 'no-'", () => {
    expect(configErrorCode(() => defineCommand({ name: "cli", options: { "no-color": {} } }))).toBe(
      "ERR_RESERVED_NAME",
    );
  });

  it("rejects a short flag longer than one letter", () => {
    expect(
      configErrorCode(() => defineCommand({ name: "cli", options: { env: { short: "en" } } })),
    ).toBe("ERR_INVALID_NAME");
  });

  it("rejects the reserved short flag 'h'", () => {
    expect(
      configErrorCode(() => defineCommand({ name: "cli", options: { host: { short: "h" } } })),
    ).toBe("ERR_RESERVED_NAME");
  });

  it("rejects the reserved short flag 'V'", () => {
    expect(
      configErrorCode(() => defineCommand({ name: "cli", options: { verbose: { short: "V" } } })),
    ).toBe("ERR_RESERVED_NAME");
  });

  it("rejects two options sharing the same short flag", () => {
    expect(
      configErrorCode(() =>
        defineCommand({
          name: "cli",
          options: { env: { short: "e" }, extra: { short: "e" } },
        }),
      ),
    ).toBe("ERR_DUPLICATE_OPTION");
  });

  it("defaults an option's type to 'string' and fills in its name", () => {
    const cmd = defineCommand({ name: "cli", options: { env: { short: "e" } } });
    expect(cmd.options.env).toEqual({ type: "string", short: "e", name: "env" });
  });

  it("preserves an explicit option type", () => {
    const cmd = defineCommand({ name: "cli", options: { port: { type: "number" } } });
    expect(cmd.options.port?.type).toBe("number");
  });
});

describe("defineCommand: positional validation", () => {
  it("rejects a non-kebab-case positional key", () => {
    expect(
      configErrorCode(() => defineCommand({ name: "cli", positionals: { FileName: {} } })),
    ).toBe("ERR_INVALID_NAME");
  });

  it("rejects a positional following a variadic one", () => {
    expect(
      configErrorCode(() =>
        defineCommand({
          name: "cli",
          positionals: { files: { multiple: true }, extra: {} },
        }),
      ),
    ).toBe("ERR_INVALID_POSITIONAL_ORDER");
  });

  it("rejects a required positional following an optional one", () => {
    expect(
      configErrorCode(() =>
        defineCommand({
          name: "cli",
          positionals: { first: {}, second: { required: true } },
        }),
      ),
    ).toBe("ERR_INVALID_POSITIONAL_ORDER");
  });

  it("accepts an optional positional following a required one", () => {
    expect(() =>
      defineCommand({
        name: "cli",
        positionals: { first: { required: true }, second: {} },
      }),
    ).not.toThrow();
  });

  it("accepts a variadic positional as the last one", () => {
    expect(() =>
      defineCommand({
        name: "cli",
        positionals: { first: {}, rest: { multiple: true } },
      }),
    ).not.toThrow();
  });

  it("defaults a positional's type to 'string' and fills in its name", () => {
    const cmd = defineCommand({ name: "cli", positionals: { file: { required: true } } });
    expect(cmd.positionals[0]).toEqual({ type: "string", required: true, name: "file" });
  });
});

describe("defineCommand: subcommand validation", () => {
  it("rejects two subcommands with the same name", () => {
    expect(
      configErrorCode(() =>
        defineCommand({
          name: "cli",
          commands: [defineCommand({ name: "run" }), defineCommand({ name: "run" })],
        }),
      ),
    ).toBe("ERR_DUPLICATE_SUBCOMMAND");
  });

  it("rejects a subcommand alias clashing with another subcommand's name", () => {
    expect(
      configErrorCode(() =>
        defineCommand({
          name: "cli",
          commands: [
            defineCommand({ name: "run" }),
            defineCommand({ name: "exec", alias: ["run"] }),
          ],
        }),
      ),
    ).toBe("ERR_DUPLICATE_SUBCOMMAND");
  });

  it("accepts distinct subcommand names and aliases", () => {
    expect(() =>
      defineCommand({
        name: "cli",
        commands: [defineCommand({ name: "run" }), defineCommand({ name: "build" })],
      }),
    ).not.toThrow();
  });
});

describe("defineCommand: defaults & shape", () => {
  it("defaults alias and commands to empty arrays", () => {
    const cmd = defineCommand({ name: "cli" });
    expect(cmd.alias).toEqual([]);
    expect(cmd.commands).toEqual([]);
  });

  it("keeps the provided description and action", () => {
    const action = () => "ran";
    const cmd = defineCommand({ name: "cli", description: "does things", action });
    expect(cmd.description).toBe("does things");
    expect(cmd.action).toBe(action);
  });

  it("leaves action undefined when not provided", () => {
    const cmd = defineCommand({ name: "cli" });
    expect(cmd.action).toBeUndefined();
  });
});

describe("findOptionByShort / findSubCommand", () => {
  const cmd = defineCommand({
    name: "cli",
    options: { env: { short: "e" } },
    commands: [defineCommand({ name: "run", alias: ["r"] })],
  });

  it("finds an option by its short flag", () => {
    expect(findOptionByShort(cmd, "e")).toBe(cmd.options.env);
  });

  it("returns undefined when no option has that short flag", () => {
    expect(findOptionByShort(cmd, "z")).toBeUndefined();
  });

  it("finds a subcommand by name", () => {
    expect(findSubCommand(cmd, "run")?.name).toBe("run");
  });

  it("finds a subcommand by alias", () => {
    expect(findSubCommand(cmd, "r")?.name).toBe("run");
  });

  it("returns undefined when no subcommand matches", () => {
    expect(findSubCommand(cmd, "missing")).toBeUndefined();
  });
});
