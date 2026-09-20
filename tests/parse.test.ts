import { describe, expect, it } from "vitest";

import { defineCommand } from "../src/command.js";
import { parse, type ParseResult } from "../src/parse.js";

type ParseRun = Extract<ParseResult, { kind: "run" }>;
type ParseFail = Extract<ParseResult, { ok: false }>;

function ok(argv: string[], cmd = base): ParseRun {
  const result = parse(cmd, argv);
  if (!result.ok) throw new Error(`expected ok, got issues: ${JSON.stringify(result.issues)}`);
  if (result.kind !== "run") throw new Error(`expected kind "run", got "${result.kind}"`);
  return result;
}

function fail(argv: string[], cmd = base): ParseFail {
  const result = parse(cmd, argv);
  if (result.ok) throw new Error("expected parse failure, got ok");
  return result;
}

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

describe("parse: subcommands", () => {
  const run = defineCommand({ name: "run", alias: ["r"], action: () => "ran" });
  const build = defineCommand({ name: "build", action: () => "built" });
  const root = defineCommand({ name: "cli", commands: [run, build] });

  it("descends into a matching subcommand by name", () => {
    const result = ok(["run"], root);
    expect(result.command.name).toBe("run");
    expect(result.path).toEqual(["cli", "run"]);
  });

  it("descends into a matching subcommand by alias", () => {
    const result = ok(["r"], root);
    expect(result.command.name).toBe("run");
  });

  it("stops descending at the first non-matching token", () => {
    const result = ok([], root);
    expect(result.command.name).toBe("cli");
    expect(result.path).toEqual(["cli"]);
  });

  it("does not treat '--' as a subcommand token", () => {
    const result = ok(["--"], root);
    expect(result.command.name).toBe("cli");
  });
});

describe("parse: long options", () => {
  it("parses '--flag value' as two tokens", () => {
    const result = ok(["--env", "prod", "x"]);
    expect(result.options.env).toBe("prod");
  });

  it("parses '--flag=value' as one token", () => {
    const result = ok(["--env=prod", "x"]);
    expect(result.options.env).toBe("prod");
  });

  it("treats a boolean flag as true without consuming the next token", () => {
    const result = ok(["--verbose", "x"]);
    expect(result.options.verbose).toBe(true);
    expect(result.positionals.input).toBe("x");
  });

  it("negates a boolean option with --no-<name>", () => {
    const result = ok(["--no-color", "x"]);
    expect(result.options.color).toBe(false);
  });

  it("reports unknown option for --no-<name> on a non-boolean option", () => {
    const result = fail(["--no-env", "x"]);
    expect(result.issues[0]).toMatchObject({ code: "ERR_UNKNOWN_OPTION" });
  });

  it("reports ERR_UNKNOWN_OPTION for an undeclared long option", () => {
    const result = fail(["--bogus", "x"]);
    expect(result.issues[0]).toMatchObject({ code: "ERR_UNKNOWN_OPTION", value: "bogus" });
  });

  it("reports ERR_MISSING_VALUE when a value-taking long option has no value", () => {
    const result = fail(["--env"]);
    expect(result.issues.some((i) => i.code === "ERR_MISSING_VALUE" && i.param === "env")).toBe(
      true,
    );
  });

  it("collects repeated long options into the last-wins value for non-multiple params", () => {
    const result = ok(["--env=dev", "--env=prod", "x"]);
    expect(result.options.env).toBe("prod");
  });

  it("collects a multiple option into an array", () => {
    const result = ok(["--tags=a", "--tags=b", "x"]);
    expect(result.options.tags).toEqual(["a", "b"]);
  });
});

describe("parse: short options", () => {
  it("parses '-f value' as two tokens", () => {
    const result = ok(["-e", "prod", "x"]);
    expect(result.options.env).toBe("prod");
  });

  it("parses a value glued to its short flag, e.g. -eprod", () => {
    const result = ok(["-eprod", "x"]);
    expect(result.options.env).toBe("prod");
  });

  it("clusters boolean short flags, e.g. -v", () => {
    const result = ok(["-v", "x"]);
    expect(result.options.verbose).toBe(true);
  });

  it("clusters multiple boolean flags followed by a value-taking flag", () => {
    const result = ok(["-vv", "-eprod", "x"]);
    expect(result.options.verbose).toBe(true);
    expect(result.options.env).toBe("prod");
  });

  it("reports ERR_UNKNOWN_OPTION for an undeclared short flag", () => {
    const result = fail(["-z", "x"]);
    expect(result.issues[0]).toMatchObject({ code: "ERR_UNKNOWN_OPTION", value: "z" });
  });

  it("reports ERR_MISSING_VALUE when a value-taking short flag has no value", () => {
    const result = fail(["-e"]);
    expect(result.issues.some((i) => i.code === "ERR_MISSING_VALUE" && i.param === "env")).toBe(
      true,
    );
  });

  it("treats a lone '-' as a positional, not an option", () => {
    const result = ok(["-", "x"]);
    expect(result.positionals.input).toBe("-");
  });

  it("treats a leading '-<digit>' as a positional, not an option cluster", () => {
    const result = ok(["-3", "x"]);
    expect(result.positionals.input).toBe("-3");
  });
});

describe("parse: --", () => {
  it("collects everything after '--' into rest, unparsed", () => {
    const result = ok(["x", "y", "--", "--env", "prod"]);
    expect(result.rest).toEqual(["--env", "prod"]);
    expect(result.options.env).toBeUndefined();
  });

  it("produces an empty rest when there is no '--'", () => {
    const result = ok(["x"]);
    expect(result.rest).toEqual([]);
  });
});

describe("parse: --help / --version", () => {
  it("returns kind 'help' for --help", () => {
    const result = parse(base, ["--help"]);
    expect(result.ok && result.kind).toBe("help");
  });

  it("returns kind 'help' for -h", () => {
    const result = parse(base, ["-h"]);
    expect(result.ok && result.kind).toBe("help");
  });

  it("returns kind 'help' for -h inside a short cluster", () => {
    const result = parse(base, ["-vh"]);
    expect(result.ok && result.kind).toBe("help");
  });

  it("resolves a subcommand even when --help/-h appears before it", () => {
    const sub = defineCommand({ name: "run", action: () => undefined });
    const root = defineCommand({ name: "cli", commands: [sub] });
    const result = parse(root, ["-h", "run"]);
    expect(result.ok && result.kind === "help" && result.command.name).toBe("run");
    expect(result.ok && result.kind === "help" && result.path).toEqual(["cli", "run"]);
  });

  it("returns kind 'version' for --version and -V when configured at the root", () => {
    expect(parse(base, ["--version"], { version: true }).ok).toBe(true);
    const versionResult = parse(base, ["--version"], { version: true });
    expect(versionResult.ok && versionResult.kind).toBe("version");
    const shortResult = parse(base, ["-V"], { version: true });
    expect(shortResult.ok && shortResult.kind).toBe("version");
  });

  it("returns kind 'version' for -V inside a short cluster", () => {
    const result = parse(base, ["-vV"], { version: true });
    expect(result.ok && result.kind).toBe("version");
  });

  it("rejects --version as an unknown option when not configured", () => {
    const result = parse(base, ["--version"]);
    expect(!result.ok && result.issues[0]).toMatchObject({
      code: "ERR_UNKNOWN_OPTION",
      value: "version",
    });
  });

  it("rejects -V below the root command even when version is configured", () => {
    const sub = defineCommand({
      name: "commit",
      options: { message: { short: "m", required: true } },
    });
    const root = defineCommand({ name: "cli", commands: [sub] });
    const result = parse(root, ["commit", "-V"], { version: true });
    expect(!result.ok && result.issues.some((i) => i.code === "ERR_UNKNOWN_OPTION")).toBe(true);
  });

  it("never fails when help is requested, even with a missing required field", () => {
    const result = parse(base, ["--help"]);
    expect(result.ok).toBe(true);
  });

  it("reports real scan issues instead of masking them with help from the same cluster (regression)", () => {
    // "-xh": 'x' is unknown, 'h' would normally request help. The unknown
    // option must not be silently discarded just because help was also asked for.
    const result = parse(base, ["--bogus", "-xh"]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.map((i) => i.code)).toEqual([
      "ERR_UNKNOWN_OPTION",
      "ERR_UNKNOWN_OPTION",
    ]);
  });

  it("reports real scan issues instead of masking them with a version request (regression)", () => {
    const result = parse(base, ["--bogus", "--version"], { version: true });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues[0]).toMatchObject({ code: "ERR_UNKNOWN_OPTION" });
  });
});

describe("parse: positionals", () => {
  it("assigns bare tokens to positionals in declaration order", () => {
    const result = ok(["in.txt", "out.txt"]);
    expect(result.positionals).toEqual({ input: "in.txt", output: "out.txt" });
  });

  it("leaves a trailing optional positional undefined when absent", () => {
    const result = ok(["in.txt"]);
    expect(result.positionals.output).toBeUndefined();
  });

  it("slurps remaining bare tokens into a variadic positional", () => {
    const variadic = defineCommand({
      name: "app",
      positionals: { first: {}, rest: { multiple: true } },
    });
    const result = ok(["a", "b", "c"], variadic);
    expect(result.positionals).toEqual({ first: "a", rest: ["b", "c"] });
  });

  it("reports ERR_UNEXPECTED_POSITIONAL for extra bare tokens", () => {
    const result = fail(["in.txt", "out.txt", "extra"]);
    expect(result.issues[0]).toMatchObject({
      code: "ERR_UNEXPECTED_POSITIONAL",
      value: "extra",
    });
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

  it("converts the words true and false to booleans", () => {
    expect(ok(["true"], cmd).positionals.enabled).toBe(true);
    expect(ok(["false"], cmd).positionals.enabled).toBe(false);
  });

  it("converts every word of a variadic boolean positional", () => {
    expect(ok(["true", "false", "true"], cmd).positionals.more).toEqual([false, true]);
  });

  it("reports ERR_INVALID_BOOLEAN for any other word", () => {
    for (const word of ["yes", "1", "TRUE", ""]) {
      expect(fail([word], cmd).issues[0]).toMatchObject({
        code: "ERR_INVALID_BOOLEAN",
        param: "enabled",
        value: word,
      });
    }
  });

  it("falls back to the default when the positional is absent", () => {
    const withDefault = defineCommand({
      name: "app",
      positionals: { enabled: { type: "boolean", default: true } },
    });
    expect(ok([], withDefault).positionals.enabled).toBe(true);
    expect(ok(["false"], withDefault).positionals.enabled).toBe(false);
  });

  it("does not affect boolean options, which take flags", () => {
    expect(ok(["--verbose", "x"]).options.verbose).toBe(true);
    expect(fail(["--verbose=true", "x"]).issues[0]).toMatchObject({ code: "ERR_UNEXPECTED_VALUE" });
  });
});

describe("parse: coercion & defaults", () => {
  it("parses a number option", () => {
    const result = ok(["--port=8080", "x"]);
    expect(result.options.port).toBe(8080);
  });

  it("reports ERR_INVALID_NUMBER for a non-numeric value", () => {
    const result = fail(["--port=abc", "x"]);
    expect(result.issues[0]).toMatchObject({ code: "ERR_INVALID_NUMBER", param: "port" });
  });

  it("reports ERR_INVALID_NUMBER for an empty/blank value", () => {
    const result = fail(["--port=  ", "x"]);
    expect(result.issues[0]).toMatchObject({ code: "ERR_INVALID_NUMBER" });
  });

  it("rejects an inline value on a boolean long option", () => {
    const result = fail(["--verbose=false", "x"]);
    expect(result.issues[0]).toMatchObject({ code: "ERR_UNEXPECTED_VALUE", param: "verbose" });
  });

  it("rejects an inline value on a negated boolean long option, quoting what was typed", () => {
    const result = fail(["--no-color=true", "x"]);
    expect(result.issues[0]).toMatchObject({ code: "ERR_UNEXPECTED_VALUE", param: "color" });
    expect(result.issues[0]?.message).toContain('"--no-color"');
  });

  it("accepts a valid choice", () => {
    const result = ok(["--mode=dev", "x"]);
    expect(result.options.mode).toBe("dev");
  });

  it("reports ERR_INVALID_CHOICE for an invalid choice", () => {
    const result = fail(["--mode=staging", "x"]);
    expect(result.issues[0]).toMatchObject({
      code: "ERR_INVALID_CHOICE",
      param: "mode",
      value: "staging",
    });
  });

  it("falls back to the declared default when the option is absent", () => {
    const result = ok(["x"]);
    expect(result.options.color).toBe(true);
  });

  it("reports ERR_MISSING_REQUIRED for an absent required positional", () => {
    const result = fail([]);
    expect(result.issues[0]).toMatchObject({ code: "ERR_MISSING_REQUIRED", param: "input" });
  });

  it("defaults an absent non-required, non-default option to undefined", () => {
    const result = ok(["x"]);
    expect(result.options.env).toBeUndefined();
  });

  it("defaults an absent multiple option to an empty array", () => {
    const result = ok(["x"]);
    expect(result.options.tags).toEqual([]);
  });
});

describe("parse: issue accumulation", () => {
  it("accumulates every issue from a single argv in one pass", () => {
    const result = fail(["--bogus", "--port=abc"]);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toEqual(["ERR_UNKNOWN_OPTION", "ERR_INVALID_NUMBER", "ERR_MISSING_REQUIRED"]);
  });

  it("returns the deepest resolved command and its path on failure", () => {
    const sub = defineCommand({ name: "run", options: { port: { type: "number" } } });
    const root = defineCommand({ name: "cli", commands: [sub] });
    const result = fail(["run", "--port=abc"], root);
    expect(result.command.name).toBe("run");
    expect(result.path).toEqual(["cli", "run"]);
  });

  it("reports exactly one issue when a required option's value is missing (regression)", () => {
    const cmd = defineCommand({
      name: "app",
      options: { message: { short: "m", required: true } },
    });
    const result = fail(["-m"], cmd);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ code: "ERR_MISSING_VALUE", param: "message" });
  });

  it("reports exactly one issue when a required long option's value is missing (regression)", () => {
    const cmd = defineCommand({
      name: "app",
      options: { message: { required: true } },
    });
    const result = fail(["--message"], cmd);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ code: "ERR_MISSING_VALUE", param: "message" });
  });
});
