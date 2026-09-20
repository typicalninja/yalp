import { describe, expect, it } from "vitest";

import { type Command, defineCommand } from "../src/command.js";
import { parse, type ParseResult } from "../src/parse.js";

type ParseRun = Extract<ParseResult, { kind: "run" }>;
type ParseFail = Extract<ParseResult, { ok: false }>;

const base = defineCommand({
  name: "app",
  options: {
    env: { short: "e" },
    verbose: { type: "boolean", short: "v" },
    port: { type: "number" },
    color: { type: "boolean", default: true },
    mode: { choices: ["dev", "prod"] },
    tags: { multiple: true },
  },
  positionals: {
    input: { required: true },
    output: {},
  },
  action: () => "ran",
});

function ok(argv: string[], cmd: Command = base): ParseRun {
  const result = parse(cmd, argv);
  if (!result.ok) throw new Error(`expected ok, got issues: ${JSON.stringify(result.issues)}`);
  if (result.kind !== "run") throw new Error(`expected kind "run", got "${result.kind}"`);
  return result;
}

function fail(argv: string[], cmd: Command = base): ParseFail {
  const result = parse(cmd, argv);
  if (result.ok) throw new Error("expected parse failure, got ok");
  return result;
}

/** The kind of a successful parse, or "failed" when it reported issues. */
function kind(result: ParseResult): string {
  return result.ok ? result.kind : "failed";
}

describe("parse: subcommands", () => {
  const run = defineCommand({ name: "run", alias: ["r"], action: () => "ran" });
  const build = defineCommand({ name: "build", action: () => "built" });
  const root = defineCommand({ name: "cli", commands: [run, build] });

  it.each(["run", "r"])("descends into a subcommand by name or alias: %s", (token) => {
    const result = ok([token], root);
    expect(result.command.name).toBe("run");
    expect(result.path).toEqual(["cli", "run"]);
  });

  it.each([[[]], [["--"]]])("stays on the root for %j", (argv) => {
    const result = ok(argv, root);
    expect(result.command.name).toBe("cli");
    expect(result.path).toEqual(["cli"]);
  });
});

describe("parse: long options", () => {
  it.each([
    ["'--flag value'", ["--env", "prod", "x"]],
    ["'--flag=value'", ["--env=prod", "x"]],
  ])("reads a value from %s", (_label, argv) => {
    expect(ok(argv).options.env).toBe("prod");
  });

  it("treats a boolean flag as true without consuming the next token", () => {
    const result = ok(["--verbose", "x"]);
    expect(result.options.verbose).toBe(true);
    expect(result.positionals.input).toBe("x");
  });

  it("negates a boolean option with --no-<name>", () => {
    expect(ok(["--no-color", "x"]).options.color).toBe(false);
  });

  it.each([
    ["an undeclared option", "--bogus"],
    ["--no-<name> on a non-boolean option", "--no-env"],
  ])("reports ERR_UNKNOWN_OPTION for %s", (_label, token) => {
    expect(fail([token, "x"]).issues[0]).toMatchObject({ code: "ERR_UNKNOWN_OPTION" });
  });

  // Regression: option lookup must not resolve names on Object.prototype.
  it.each(["constructor", "__proto__"])("reports --%s as unknown instead of inherited", (name) => {
    for (const token of [`--${name}`, `--${name}=x`, `--no-${name}`]) {
      expect(fail([token]).issues[0]).toMatchObject({ code: "ERR_UNKNOWN_OPTION" });
    }
  });

  it("still accepts an option genuinely named constructor", () => {
    const cmd = defineCommand({ name: "app", options: { constructor: {} } });
    expect(ok(["--constructor=x"], cmd).options.constructor).toBe("x");
  });

  it("keeps the last value of a repeated single-value option and every value of a multiple one", () => {
    const result = ok(["--env=dev", "--env=prod", "--tags=a", "--tags=b", "x"]);
    expect(result.options.env).toBe("prod");
    expect(result.options.tags).toEqual(["a", "b"]);
  });
});

describe("parse: short options", () => {
  it.each([
    ["a separate value", ["-e", "prod", "x"]],
    ["a value glued to the flag", ["-eprod", "x"]],
  ])("reads a value from %s", (_label, argv) => {
    expect(ok(argv).options.env).toBe("prod");
  });

  it("clusters boolean flags ahead of a value-taking flag", () => {
    const result = ok(["-vv", "-eprod", "x"]);
    expect(result.options.verbose).toBe(true);
    expect(result.options.env).toBe("prod");
  });

  it("reports ERR_UNKNOWN_OPTION for an undeclared short flag", () => {
    expect(fail(["-z", "x"]).issues[0]).toMatchObject({ code: "ERR_UNKNOWN_OPTION", value: "z" });
  });

  it.each(["-", "-3"])("treats %s as a positional, not an option", (token) => {
    expect(ok([token]).positionals.input).toBe(token);
  });
});

describe("parse: missing values", () => {
  // Regression: a missing value must not additionally report the option as missing.
  it.each([
    ["short", ["-m"]],
    ["long", ["--message"]],
  ])("reports exactly one issue for a required %s option without a value", (_label, argv) => {
    const cmd = defineCommand({
      name: "app",
      options: { message: { short: "m", required: true } },
    });
    const { issues } = fail(argv, cmd);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "ERR_MISSING_VALUE", param: "message" });
  });
});

describe("parse: --", () => {
  it("collects everything after '--' into rest, unparsed", () => {
    const result = ok(["x", "--", "--env", "prod"]);
    expect(result.rest).toEqual(["--env", "prod"]);
    expect(result.options.env).toBeUndefined();
  });

  it("produces an empty rest when there is no '--'", () => {
    expect(ok(["x"]).rest).toEqual([]);
  });
});

describe("parse: --help / --version", () => {
  it.each([["--help"], ["-h"], ["-vh"]])("returns kind 'help' for %s", (token) => {
    expect(kind(parse(base, [token]))).toBe("help");
  });

  it("resolves the subcommand even when -h appears before it", () => {
    const sub = defineCommand({ name: "run", action: () => undefined });
    const root = defineCommand({ name: "cli", commands: [sub] });
    const result = parse(root, ["-h", "run"]);

    expect(result).toMatchObject({ ok: true, kind: "help", path: ["cli", "run"] });
  });

  it.each([["--version"], ["-V"], ["-vV"]])("returns kind 'version' for %s", (token) => {
    expect(kind(parse(base, [token], { version: true }))).toBe("version");
  });

  it("treats --version as an unknown option when version is not configured", () => {
    const result = parse(base, ["--version"]);
    expect(!result.ok && result.issues[0]).toMatchObject({
      code: "ERR_UNKNOWN_OPTION",
      value: "version",
    });
  });

  it("treats -V below the root as an unknown option even when version is configured", () => {
    const sub = defineCommand({
      name: "commit",
      options: { message: { short: "m", required: true } },
    });
    const root = defineCommand({ name: "cli", commands: [sub] });
    const result = parse(root, ["commit", "-V"], { version: true });

    expect(kind(result)).toBe("failed");
    expect(!result.ok && result.issues.map((i) => i.code)).toContain("ERR_UNKNOWN_OPTION");
  });

  // Regression: a help or version request must not mask real scan issues.
  it.each([
    ["help", ["--bogus", "-xh"], {}],
    ["version", ["--bogus", "--version"], { version: true }],
  ])("reports scan issues instead of masking them with a %s request", (_label, argv, options) => {
    const result = parse(base, argv, options);
    expect(kind(result)).toBe("failed");
    expect(!result.ok && result.issues[0]).toMatchObject({ code: "ERR_UNKNOWN_OPTION" });
  });
});

describe("parse: positionals", () => {
  it("assigns bare tokens in declaration order, leaving absent optional ones undefined", () => {
    expect(ok(["in.txt", "out.txt"]).positionals).toEqual({ input: "in.txt", output: "out.txt" });
    expect(ok(["in.txt"]).positionals.output).toBeUndefined();
  });

  it("slurps remaining bare tokens into a variadic positional", () => {
    const variadic = defineCommand({
      name: "app",
      positionals: { first: {}, rest: { multiple: true } },
    });
    expect(ok(["a", "b", "c"], variadic).positionals).toEqual({ first: "a", rest: ["b", "c"] });
  });

  it("reports ERR_UNEXPECTED_POSITIONAL for extra bare tokens", () => {
    expect(fail(["in.txt", "out.txt", "extra"]).issues[0]).toMatchObject({
      code: "ERR_UNEXPECTED_POSITIONAL",
      value: "extra",
    });
  });

  it("reports ERR_MISSING_REQUIRED for an absent required positional", () => {
    expect(fail([]).issues[0]).toMatchObject({ code: "ERR_MISSING_REQUIRED", param: "input" });
  });
});

describe("parse: boolean positionals", () => {
  const cmd = defineCommand({
    name: "app",
    positionals: {
      enabled: { type: "boolean", required: true },
      more: { type: "boolean", multiple: true },
    },
  });

  it("converts the words true and false to booleans, including variadic ones", () => {
    expect(ok(["true"], cmd).positionals.enabled).toBe(true);
    expect(ok(["false"], cmd).positionals.enabled).toBe(false);
    expect(ok(["true", "false", "true"], cmd).positionals.more).toEqual([false, true]);
  });

  it.each(["yes", "1", "TRUE", ""])("reports ERR_INVALID_BOOLEAN for %j", (word) => {
    expect(fail([word], cmd).issues[0]).toMatchObject({
      code: "ERR_INVALID_BOOLEAN",
      param: "enabled",
      value: word,
    });
  });

  it("falls back to the default when absent", () => {
    const withDefault = defineCommand({
      name: "app",
      positionals: { enabled: { type: "boolean", default: true } },
    });
    expect(ok([], withDefault).positionals.enabled).toBe(true);
    expect(ok(["false"], withDefault).positionals.enabled).toBe(false);
  });
});

describe("parse: repeated boolean options", () => {
  const cmd = defineCommand({
    name: "app",
    options: {
      verbose: { type: "boolean", short: "v", multiple: true },
      quiet: { type: "boolean", short: "q" },
    },
  });
  const verbose = (argv: string[]) => ok(argv, cmd).options.verbose;

  it.each([
    ["-vvv", ["-vvv"], [true, true, true]],
    ["mixed short and long", ["-v", "-v", "--verbose"], [true, true, true]],
    ["a cluster with other flags", ["-vqv"], [true, true]],
    ["negations, in order", ["--verbose", "--no-verbose", "-v"], [true, false, true]],
    ["no occurrences", [], []],
  ])("collects one entry per occurrence for %s", (_label, argv, expected) => {
    expect(verbose(argv)).toEqual(expected);
  });
});

describe("parse: values and defaults", () => {
  it("parses a number option", () => {
    expect(ok(["--port=8080", "x"]).options.port).toBe(8080);
  });

  it.each(["abc", "  "])("reports ERR_INVALID_NUMBER for %j", (value) => {
    expect(fail([`--port=${value}`, "x"]).issues[0]).toMatchObject({
      code: "ERR_INVALID_NUMBER",
      param: "port",
    });
  });

  it.each([
    ["--verbose=false", "verbose", '"--verbose"'],
    ["--no-color=true", "color", '"--no-color"'],
  ])(
    "rejects an inline value on the boolean %s, quoting what was typed",
    (token, param, quoted) => {
      const [issue] = fail([token, "x"]).issues;
      expect(issue).toMatchObject({ code: "ERR_UNEXPECTED_VALUE", param });
      expect(issue?.message).toContain(quoted);
    },
  );

  it("accepts a valid choice and reports an invalid one", () => {
    expect(ok(["--mode=dev", "x"]).options.mode).toBe("dev");
    expect(fail(["--mode=staging", "x"]).issues[0]).toMatchObject({
      code: "ERR_INVALID_CHOICE",
      param: "mode",
      value: "staging",
    });
  });

  it("defaults absent options: declared default, undefined, or empty array for multiple", () => {
    const { options } = ok(["x"]);
    expect(options.color).toBe(true);
    expect(options.env).toBeUndefined();
    expect(options.tags).toEqual([]);
  });
});

describe("parse: issue accumulation", () => {
  it("accumulates every issue from a single argv in one pass", () => {
    const codes = fail(["--bogus", "--port=abc"]).issues.map((i) => i.code);
    expect(codes).toEqual(["ERR_UNKNOWN_OPTION", "ERR_INVALID_NUMBER", "ERR_MISSING_REQUIRED"]);
  });

  it("returns the deepest resolved command and its path on failure", () => {
    const sub = defineCommand({ name: "run", options: { port: { type: "number" } } });
    const root = defineCommand({ name: "cli", commands: [sub] });
    const result = fail(["run", "--port=abc"], root);

    expect(result.command.name).toBe("run");
    expect(result.path).toEqual(["cli", "run"]);
  });
});
