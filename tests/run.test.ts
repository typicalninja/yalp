import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defineCommand } from "../src/command.js";
import { run } from "../src/run.js";

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  process.exitCode = undefined;
  delete process.env.DEBUG;
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  process.exitCode = undefined;
  delete process.env.DEBUG;
});

describe("run: success", () => {
  it("invokes the matched action with parsed options, positionals, and rest", async () => {
    const action = vi.fn();
    const cmd = defineCommand({
      name: "app",
      options: { env: {} },
      positionals: { file: { required: true } },
      action,
    });

    await run(cmd, { argv: ["--env=prod", "a.txt", "--", "x"] });

    expect(action).toHaveBeenCalledWith({
      options: { env: "prod" },
      positionals: { file: "a.txt" },
      rest: ["x"],
    });
    expect(process.exitCode).toBeUndefined();
  });
});

describe("run: help/version", () => {
  it("prints help and returns without running the action for --help", async () => {
    const action = vi.fn();
    const cmd = defineCommand({ name: "app", action });

    await run(cmd, { argv: ["--help"] });

    expect(action).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage: app"));
  });

  it("prints the version and returns for --version when a version string is configured", async () => {
    const action = vi.fn();
    const cmd = defineCommand({ name: "app", action });

    await run(cmd, { argv: ["--version"], version: "1.2.3" });

    expect(action).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("1.2.3");
  });

  it("rejects --version as an unknown option when run() was not given a version string", async () => {
    const action = vi.fn();
    const cmd = defineCommand({ name: "app", action });

    await run(cmd, { argv: ["--version"] });

    expect(action).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    const printed = errorSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain('unknown option "--version"');
  });
});

describe("run: no action", () => {
  it("prints help and exits 0 for a leaf command with no action", async () => {
    const cmd = defineCommand({ name: "app" });

    // The built-in completions command would make this a group command, so opt out.
    await run(cmd, { argv: [], completions: false });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage: app"));
    expect(process.exitCode).toBe(0);
  });

  it("prints help and exits 2 for a parent command with subcommands and no action", async () => {
    const sub = defineCommand({ name: "child", action: () => undefined });
    const cmd = defineCommand({ name: "app", commands: [sub] });

    await run(cmd, { argv: [] });

    expect(process.exitCode).toBe(2);
  });

  it("prints the no-subcommand-selected usage to stderr, not stdout", async () => {
    const sub = defineCommand({ name: "child", action: () => undefined });
    const cmd = defineCommand({ name: "app", commands: [sub] });

    await run(cmd, { argv: [] });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Usage: app"));
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe("run: parse failure + did-you-mean", () => {
  it("prints formatted issues, a usage hint, and sets exitCode 2", async () => {
    const cmd = defineCommand({ name: "app", options: { verbose: { type: "boolean" } } });

    await run(cmd, { argv: ["--verbos"] });

    expect(process.exitCode).toBe(2);
    const printed = errorSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain("unknown option");
    expect(printed).toContain("did you mean --verbose?");
    expect(printed).toContain('Run "app --help" for usage.');
  });

  it("pluralizes 'problem' as singular for exactly one issue", async () => {
    const cmd = defineCommand({ name: "app", options: { verbose: { type: "boolean" } } });

    await run(cmd, { argv: ["--verbos"] });

    const printed = errorSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain("app: 1 problem");
    expect(printed).not.toContain("1 problems");
  });

  it("pluralizes 'problems' for more than one issue", async () => {
    const cmd = defineCommand({
      name: "app",
      options: { verbose: { type: "boolean" } },
      positionals: { file: { required: true } },
    });

    await run(cmd, { argv: ["--verbos"] });

    const printed = errorSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain("app: 2 problems");
  });

  it("omits the did-you-mean line for an issue with no offending value, e.g. a missing required field", async () => {
    const cmd = defineCommand({
      name: "app",
      positionals: { file: { required: true } },
    });

    await run(cmd, { argv: [] });

    const printed = errorSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain('"file" is required');
    expect(printed).not.toContain("did you mean");
  });

  it("omits the did-you-mean line when nothing is close enough", async () => {
    const cmd = defineCommand({ name: "app", options: { verbose: { type: "boolean" } } });

    await run(cmd, { argv: ["--zzz"] });

    const printed = errorSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).not.toContain("did you mean");
  });

  it("omits the did-you-mean line for an unexpected positional when there are no subcommands to suggest", async () => {
    const cmd = defineCommand({ name: "app" });

    await run(cmd, { argv: ["extra"] });

    const printed = errorSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).not.toContain("did you mean");
  });

  it("shows only one did-you-mean hint for unexpected positionals, even when it cascades into several", async () => {
    const sub = defineCommand({ name: "commit", action: () => undefined });
    const cmd = defineCommand({ name: "app", commands: [sub] });

    await run(cmd, { argv: ["comit", "y"] });

    const printed = errorSpy.mock.calls.map((call) => call[0]).join("\n");
    const hints = printed.split("did you mean").length - 1;
    expect(hints).toBe(1);
  });

  it("shows a hint for each unrelated unknown-option typo, not just the first (regression)", async () => {
    const cmd = defineCommand({
      name: "app",
      options: { times: { type: "number" }, shout: { type: "boolean" } },
    });

    await run(cmd, { argv: ["--tims", "3", "--shuot"] });

    const printed = errorSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain("did you mean --times?");
    expect(printed).toContain("did you mean --shout?");
  });

  it("suggests a subcommand name for an unexpected positional", async () => {
    const sub = defineCommand({ name: "build", action: () => undefined });
    const cmd = defineCommand({ name: "app", commands: [sub] });

    await run(cmd, { argv: ["buidl"] });

    const printed = errorSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain("did you mean build?");
  });

  it("suggests a valid choice for an invalid choice value", async () => {
    const cmd = defineCommand({
      name: "app",
      options: { mode: { choices: ["dev", "prod"] } },
      action: () => undefined,
    });

    await run(cmd, { argv: ["--mode=dvv"] });

    const printed = errorSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain("did you mean dev?");
  });

  it("suggests a valid choice for an invalid choice on a positional", async () => {
    const cmd = defineCommand({
      name: "app",
      positionals: { mode: { choices: ["dev", "prod"], required: true } },
      action: () => undefined,
    });

    await run(cmd, { argv: ["dvv"] });

    const printed = errorSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain('"mode" must be one of: dev, prod');
    expect(printed).toContain("did you mean dev?");
  });
});

describe("run: action throws/rejects", () => {
  it("catches a thrown error, prints its message, and sets exitCode 1", async () => {
    const cmd = defineCommand({
      name: "app",
      action: () => {
        throw new Error("boom");
      },
    });

    await run(cmd, { argv: [] });

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("app failed: boom");
  });

  it("catches a rejected promise from an async action", async () => {
    const cmd = defineCommand({
      name: "app",
      action: async () => {
        throw new Error("async boom");
      },
    });

    await run(cmd, { argv: [] });

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("app failed: async boom");
  });

  it("wraps a non-Error throw in an Error using its string form", async () => {
    const cmd = defineCommand({
      name: "app",
      action: () => {
        throw "plain string";
      },
    });

    await run(cmd, { argv: [] });

    expect(errorSpy).toHaveBeenCalledWith("app failed: plain string");
  });

  it("does not print a stack trace when DEBUG is unset", async () => {
    const cmd = defineCommand({
      name: "app",
      action: () => {
        throw new Error("boom");
      },
    });

    await run(cmd, { argv: [] });

    const printedStacks = errorSpy.mock.calls.filter((call) => String(call[0]).includes("at "));
    expect(printedStacks).toHaveLength(0);
  });

  it("prints a stack trace when DEBUG is set", async () => {
    process.env.DEBUG = "1";
    const cmd = defineCommand({
      name: "app",
      action: () => {
        throw new Error("boom");
      },
    });

    await run(cmd, { argv: [] });

    expect(errorSpy).toHaveBeenCalledTimes(2);
  });
});

describe("run: regressions", () => {
  it("reports exactly one issue when a required option's value is missing", async () => {
    const action = vi.fn();
    const cmd = defineCommand({
      name: "app",
      options: { message: { short: "m", required: true } },
      action,
    });

    await run(cmd, { argv: ["-m"] });

    expect(action).not.toHaveBeenCalled();
    const printed = errorSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain("app: 1 problem");
    expect(printed).not.toContain("2 problems");
  });

  it("shows a subcommand's help even when -h appears before the subcommand name", async () => {
    const sub = defineCommand({ name: "child", action: () => undefined });
    const cmd = defineCommand({ name: "app", commands: [sub] });

    await run(cmd, { argv: ["-h", "child"] });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage: app child"));
  });

  it("rejects an inline value on a boolean option instead of silently ignoring it", async () => {
    const action = vi.fn();
    const cmd = defineCommand({
      name: "app",
      options: { shout: { type: "boolean" } },
      action,
    });

    await run(cmd, { argv: ["--shout=false"] });

    expect(action).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    const printed = errorSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain('"--shout" is a flag');
  });

  it("rejects -V on a subcommand instead of silently skipping required validation", async () => {
    const action = vi.fn();
    const sub = defineCommand({
      name: "commit",
      options: { message: { short: "m", required: true } },
      action,
    });
    const cmd = defineCommand({ name: "app", commands: [sub] });

    await run(cmd, { argv: ["commit", "-V"], version: "1.0.0" });

    expect(action).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
  });
});

describe("run: completions", () => {
  const app = () => defineCommand({ name: "my-app", action: () => undefined });

  it.each(["bash", "fish", "zsh"])("prints the %s completion script", async (shell) => {
    await run(app(), { argv: ["completions", shell] });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(String(logSpy.mock.calls[0]?.[0])).toContain("my-app");
    expect(process.exitCode).toBeUndefined();
  });

  it("lists the completions command in the root help", async () => {
    await run(app(), { argv: ["--help"] });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("completions"));
  });

  it("suggests the nearest shell for a mistyped one", async () => {
    await run(app(), { argv: ["completions", "fsh"] });

    expect(process.exitCode).toBe(2);
    const printed = errorSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain("did you mean fish?");
  });

  it("does not mutate the command it was given", async () => {
    const cmd = app();

    await run(cmd, { argv: ["completions", "bash"] });

    expect(cmd.commands).toHaveLength(0);
  });

  it("rejects a root that already defines a completions command", async () => {
    const cmd = defineCommand({
      name: "app",
      commands: [defineCommand({ name: "completions", action: () => undefined })],
    });

    await expect(run(cmd, { argv: [] })).rejects.toMatchObject({ code: "ERR_RESERVED_NAME" });
  });

  it("rejects a root whose alias is completions", async () => {
    const cmd = defineCommand({
      name: "app",
      commands: [defineCommand({ name: "gen", alias: ["completions"], action: () => undefined })],
    });

    await expect(run(cmd, { argv: [] })).rejects.toMatchObject({ code: "ERR_RESERVED_NAME" });
  });

  it("lets an app define its own completions command when built-in completions are off", async () => {
    const action = vi.fn();
    const cmd = defineCommand({
      name: "app",
      commands: [defineCommand({ name: "completions", action })],
    });

    await run(cmd, { argv: ["completions"], completions: false });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("registers no completions command when built-in completions are off", async () => {
    await run(app(), { argv: ["completions", "bash"], completions: false });

    expect(process.exitCode).toBe(2);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
