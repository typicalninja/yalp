import { describe, expectTypeOf, it } from "vitest";

import { defineCommand } from "../src/command.js";
import type { Command, ParamSpec, ParamValue } from "../src/index.js";

describe("array inputs", () => {
  it("accept mutable and readonly arrays for alias, examples, and commands", () => {
    const sub = defineCommand({ name: "sub" });
    const aliases = ["b"] as const;
    const examples = ["--fast", ["--slow", "take your time"]] as const;
    const subs = [sub] as const;
    const readonlyAliases: readonly string[] = ["r"];
    const readonlySubs: readonly Command[] = [sub];

    defineCommand({ name: "a", alias: ["m"], examples: ["--fast"], commands: [sub] });
    defineCommand({ name: "b", alias: aliases, examples, commands: subs });
    defineCommand({ name: "c", alias: readonlyAliases, commands: readonlySubs });
  });

  it("reject values of the wrong element type", () => {
    // @ts-expect-error alias takes strings
    defineCommand({ name: "a", alias: [1] });
    // @ts-expect-error commands takes commands
    defineCommand({ name: "b", commands: ["sub"] });
  });
});

describe("action argument inference", () => {
  it("types options from their declarations", () => {
    defineCommand({
      name: "t",
      options: {
        plain: {},
        required: { required: true },
        withDefault: { default: "x" },
        count: { type: "number" },
        countDefault: { type: "number", default: 1 },
        flag: { type: "boolean" },
        flagDefault: { type: "boolean", default: true },
        tags: { multiple: true },
        verbosity: { type: "boolean", short: "v", multiple: true },
        mode: { choices: ["a", "b"] },
        modeRequired: { choices: ["a", "b"], required: true },
        level: { type: "number", choices: [1, 2] },
        "dry-run": { type: "boolean" },
      },
      action: ({ options }) => {
        expectTypeOf(options.plain).toEqualTypeOf<string | undefined>();
        expectTypeOf(options.required).toEqualTypeOf<string>();
        expectTypeOf(options.withDefault).toEqualTypeOf<string>();
        expectTypeOf(options.count).toEqualTypeOf<number | undefined>();
        expectTypeOf(options.countDefault).toEqualTypeOf<number>();
        expectTypeOf(options.flag).toEqualTypeOf<boolean | undefined>();
        expectTypeOf(options.flagDefault).toEqualTypeOf<boolean>();
        expectTypeOf(options.tags).toEqualTypeOf<string[]>();
        expectTypeOf(options.verbosity).toEqualTypeOf<boolean[]>();
        expectTypeOf(options.mode).toEqualTypeOf<"a" | "b" | undefined>();
        expectTypeOf(options.modeRequired).toEqualTypeOf<"a" | "b">();
        expectTypeOf(options.level).toEqualTypeOf<1 | 2 | undefined>();
        expectTypeOf(options["dry-run"]).toEqualTypeOf<boolean | undefined>();
      },
    });
  });

  it("types positionals from their declarations", () => {
    defineCommand({
      name: "t",
      positionals: {
        source: { required: true },
        target: {},
        enabled: { type: "boolean" },
        files: { multiple: true },
      },
      action: ({ positionals, rest }) => {
        expectTypeOf(positionals.source).toEqualTypeOf<string>();
        expectTypeOf(positionals.target).toEqualTypeOf<string | undefined>();
        expectTypeOf(positionals.enabled).toEqualTypeOf<boolean | undefined>();
        expectTypeOf(positionals.files).toEqualTypeOf<string[]>();
        expectTypeOf(rest).toEqualTypeOf<string[]>();
      },
    });
  });

  it("rejects a name that was not declared", () => {
    defineCommand({
      name: "t",
      options: { known: {} },
      action: ({ options }) => {
        // @ts-expect-error `unknown` is not a declared option
        void options.unknown;
      },
    });
  });
});

describe("ParamValue", () => {
  it("resolves a declaration to the action's value type", () => {
    expectTypeOf<ParamValue<{ type: "number"; default: 1 }>>().toEqualTypeOf<number>();
    expectTypeOf<ParamValue<{ multiple: true }>>().toEqualTypeOf<string[]>();
    expectTypeOf<ParamValue<ParamSpec>>().toEqualTypeOf<string | undefined>();
  });
});

describe("public entry point", () => {
  it("returns a command with mutable array fields", () => {
    const cmd = defineCommand({ name: "t", alias: ["a"] as const });
    expectTypeOf(cmd).toEqualTypeOf<Command>();
    expectTypeOf(cmd.alias).toEqualTypeOf<string[]>();
    expectTypeOf(cmd.commands).toEqualTypeOf<Command[]>();
  });

  it("does not export internal helpers or types", () => {
    // A name the entry point does not export resolves to `any`; a real export would not.
    // @ts-expect-error internal type
    type Action = import("../src/index.js").CommandAction;
    // @ts-expect-error internal helper
    type Finder = typeof import("../src/index.js").findSubCommand;
    // @ts-expect-error internal type
    type Options = import("../src/index.js").ConfigErrorOptions;

    expectTypeOf<Action>().toBeAny();
    expectTypeOf<Finder>().toBeAny();
    expectTypeOf<Options>().toBeAny();
  });
});
