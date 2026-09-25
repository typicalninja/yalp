import { describe, expect, it } from "vitest";

import { defineCommand } from "../src/command.js";
import type { ParamSpec } from "../src/parameter.js";

const noop = () => undefined;
const configError = (code: string) => expect.objectContaining({ name: "ConfigError", code });

describe("defineCommand: names", () => {
  it.each<[string, () => unknown, string]>([
    ["a non-kebab-case command name", () => defineCommand({ name: "MyCli" }), "ERR_INVALID_NAME"],
    [
      "a non-kebab-case alias",
      () => defineCommand({ name: "cli", alias: ["Bad_Alias"] }),
      "ERR_INVALID_NAME",
    ],
    [
      "a non-kebab-case option key",
      () => defineCommand({ name: "cli", options: { fooBar: {} } }),
      "ERR_INVALID_NAME",
    ],
    [
      "a positional key with a separator character",
      () => defineCommand({ name: "cli", positionals: { "file:name": {} } }),
      "ERR_INVALID_NAME",
    ],
    [
      "a short flag longer than one letter",
      () => defineCommand({ name: "cli", options: { env: { short: "en" } } }),
      "ERR_INVALID_NAME",
    ],
    [
      "the reserved option name 'help'",
      () => defineCommand({ name: "cli", options: { help: {} } }),
      "ERR_RESERVED_NAME",
    ],
    [
      "the reserved option name 'version'",
      () => defineCommand({ name: "cli", options: { version: {} } }),
      "ERR_RESERVED_NAME",
    ],
    [
      "an option name starting with 'no-'",
      () => defineCommand({ name: "cli", options: { "no-color": {} } }),
      "ERR_RESERVED_NAME",
    ],
    [
      "the reserved short flag 'h'",
      () => defineCommand({ name: "cli", options: { host: { short: "h" } } }),
      "ERR_RESERVED_NAME",
    ],
    [
      "the reserved short flag 'V'",
      () => defineCommand({ name: "cli", options: { verbose: { short: "V" } } }),
      "ERR_RESERVED_NAME",
    ],
  ])("rejects %s", (_label, define, code) => {
    expect(define).toThrow(configError(code));
  });

  it("accepts kebab-case names, aliases, and keys", () => {
    expect(() =>
      defineCommand({
        name: "my-cli",
        alias: ["c", "cli-alt"],
        options: { "dry-run": {} },
        positionals: { "input-file": {} },
      }),
    ).not.toThrow();
  });

  it("accepts camelCase and snake_case positional keys", () => {
    expect(() =>
      defineCommand({ name: "cli", positionals: { inputFile: {}, output_dir: {} } }),
    ).not.toThrow();
  });
});

describe("defineCommand: parameter declarations", () => {
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
      expect(() => define(spec)).toThrow(configError("ERR_INVALID_PARAM"));
    });

    it.each<[string, ParamSpec]>([
      ["a default among its choices", { choices: ["a", "b"], default: "a" }],
      ["numeric choices on a number", { type: "number", choices: [1, 2], default: 2 }],
      ["a multiple default among its choices", { multiple: true, choices: ["a"], default: ["a"] }],
      ["a variadic boolean default", { type: "boolean", multiple: true, default: [true, false] }],
      ["required together with a default", { required: true, default: "x" }],
    ])("accepts %s", (_label, spec) => {
      expect(() => define(spec)).not.toThrow();
    });
  });

  it("rejects a short flag on a positional", () => {
    expect(() => defineCommand({ name: "cli", positionals: { file: { short: "f" } } })).toThrow(
      configError("ERR_INVALID_PARAM"),
    );
  });

  it("names the parameter and the problem in the message", () => {
    expect(() =>
      defineCommand({ name: "cli", options: { mode: { choices: ["a"], default: "b" } } }),
    ).toThrow('option "mode" default must be one of its choices');
  });
});

describe("defineCommand: structure", () => {
  it.each<[string, () => unknown, string]>([
    [
      "two options sharing a short flag",
      () => defineCommand({ name: "cli", options: { env: { short: "e" }, extra: { short: "e" } } }),
      "ERR_DUPLICATE_OPTION",
    ],
    [
      "a positional following a variadic one",
      () => defineCommand({ name: "cli", positionals: { files: { multiple: true }, extra: {} } }),
      "ERR_INVALID_POSITIONAL_ORDER",
    ],
    [
      "a required positional following an optional one",
      () => defineCommand({ name: "cli", positionals: { first: {}, second: { required: true } } }),
      "ERR_INVALID_POSITIONAL_ORDER",
    ],
    [
      "two subcommands with the same name",
      () =>
        defineCommand({
          name: "cli",
          commands: [defineCommand({ name: "run" }), defineCommand({ name: "run" })],
        }),
      "ERR_DUPLICATE_SUBCOMMAND",
    ],
    [
      "a subcommand alias clashing with another subcommand's name",
      () =>
        defineCommand({
          name: "cli",
          commands: [
            defineCommand({ name: "run" }),
            defineCommand({ name: "exec", alias: ["run"] }),
          ],
        }),
      "ERR_DUPLICATE_SUBCOMMAND",
    ],
  ])("rejects %s", (_label, define, code) => {
    expect(define).toThrow(configError(code));
  });

  it("accepts optional and variadic positionals after required ones", () => {
    expect(() =>
      defineCommand({
        name: "cli",
        positionals: { first: { required: true }, second: {}, rest: { multiple: true } },
      }),
    ).not.toThrow();
  });
});

describe("defineCommand: normalized shape", () => {
  it("fills in the type and name of options and positionals", () => {
    const cmd = defineCommand({
      name: "cli",
      options: { env: { short: "e" }, port: { type: "number" } },
      positionals: { file: { required: true } },
    });

    expect(cmd.options.env).toEqual({ type: "string", short: "e", name: "env" });
    expect(cmd.options.port?.type).toBe("number");
    expect(cmd.positionals[0]).toEqual({ type: "string", required: true, name: "file" });
  });

  it("defaults alias and commands to empty arrays and leaves action undefined", () => {
    expect(defineCommand({ name: "cli" })).toMatchObject({
      alias: [],
      commands: [],
      action: undefined,
    });
  });

  it("copies alias, examples, and commands so later changes to the inputs do not leak in", () => {
    const alias = ["c"];
    const examples = ["--watch"];
    const commands = [defineCommand({ name: "sub", action: noop })];
    const cmd = defineCommand({ name: "cli", alias, examples, commands });

    alias.push("d");
    examples.push("--fast");
    commands.length = 0;

    expect(cmd.alias).toEqual(["c"]);
    expect(cmd.examples).toEqual(["--watch"]);
    expect(cmd.commands).toHaveLength(1);
  });
});
