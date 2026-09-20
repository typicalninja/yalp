import { describe, expect, it } from "vitest";

import { defineCommand, findOptionByShort, findSubCommand } from "../src/command.js";
import { ConfigError } from "../src/errors.js";
import type { ParamSpec } from "../src/parameter.js";

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

describe("defineCommand: parameter declaration validation", () => {
  const contradictions: [string, ParamSpec][] = [
    ["a default outside its choices", { choices: ["a", "b"], default: "c" }],
    [
      "a multiple default with a value outside its choices",
      { multiple: true, choices: ["a"], default: ["a", "z"] },
    ],
    ["choices on a boolean", { type: "boolean", choices: ["a"] }],
    ["empty choices", { choices: [] }],
    ["string choices on a number", { type: "number", choices: ["a"] }],
    ["number choices on a string", { choices: [1, 2] }],
    ["a default of the wrong type", { type: "number", default: "x" }],
    ["a scalar default on a multiple parameter", { multiple: true, default: "a" }],
    ["an array default on a single-value parameter", { default: ["a"] }],
  ];

  describe.each([
    ["option", (spec: ParamSpec) => defineCommand({ name: "cli", options: { p: spec } })],
    ["positional", (spec: ParamSpec) => defineCommand({ name: "cli", positionals: { p: spec } })],
  ])("as an %s", (_kind, define) => {
    it.each(contradictions)("rejects %s", (_label, spec) => {
      expect(configErrorCode(() => define(spec))).toBe("ERR_INVALID_PARAM");
    });

    it.each<[string, ParamSpec]>([
      ["a default among its choices", { choices: ["a", "b"], default: "a" }],
      ["numeric choices on a number", { type: "number", choices: [1, 2], default: 2 }],
      [
        "a multiple default among its choices",
        { multiple: true, choices: ["a", "b"], default: ["a"] },
      ],
      ["choices on a multiple parameter without a default", { multiple: true, choices: ["a"] }],
      ["a boolean default", { type: "boolean", default: true }],
      ["a variadic boolean default", { type: "boolean", multiple: true, default: [true, false] }],
      ["required together with a default", { required: true, default: "x" }],
    ])("accepts %s", (_label, spec) => {
      expect(() => define(spec)).not.toThrow();
    });
  });

  it("rejects a short on a positional", () => {
    expect(
      configErrorCode(() => defineCommand({ name: "cli", positionals: { file: { short: "f" } } })),
    ).toBe("ERR_INVALID_PARAM");
  });

  it("names the parameter and the problem in the message", () => {
    try {
      defineCommand({ name: "cli", options: { mode: { choices: ["a"], default: "b" } } });
    } catch (error) {
      expect((error as ConfigError).message).toBe(
        'option "mode" default must be one of its choices',
      );
      return;
    }
    throw new Error("expected defineCommand to throw");
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

  it("keeps the provided description, examples, and action", () => {
    const action = () => "ran";
    const cmd = defineCommand({
      name: "cli",
      description: "does things",
      examples: ["--watch"],
      action,
    });
    expect(cmd.description).toBe("does things");
    expect(cmd.examples).toEqual(["--watch"]);
    expect(cmd.action).toBe(action);
  });

  it("accepts readonly arrays for alias, examples, and commands", () => {
    const sub = defineCommand({ name: "sub" });
    const cmd = defineCommand({
      name: "cli",
      alias: ["c"] as const,
      examples: ["--watch", ["--fast", "skip checks"]] as const,
      commands: [sub] as const,
    });
    expect(cmd.alias).toEqual(["c"]);
    expect(cmd.examples).toEqual(["--watch", ["--fast", "skip checks"]]);
    expect(cmd.commands).toEqual([sub]);
  });

  it("copies alias, examples, and commands so later changes to the inputs do not leak in", () => {
    const alias = ["c"];
    const examples = ["--watch"];
    const commands = [defineCommand({ name: "sub" })];
    const cmd = defineCommand({ name: "cli", alias, examples, commands });

    alias.push("d");
    examples.push("--fast");
    commands.length = 0;

    expect(cmd.alias).toEqual(["c"]);
    expect(cmd.examples).toEqual(["--watch"]);
    expect(cmd.commands).toHaveLength(1);
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
