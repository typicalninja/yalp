import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defineCommand } from "../src/command.js";
import { run } from "../src/run.js";

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

const noop = () => undefined;
/** Everything written to stderr, joined by newlines. */
const stderr = () => errorSpy.mock.calls.map((call) => call[0]).join("\n");

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(noop);
  errorSpy = vi.spyOn(console, "error").mockImplementation(noop);
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
    const action = vi.fn<(context: unknown) => void>();
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

describe("run: help and version", () => {
  it("prints help without running the action for --help", async () => {
    const action = vi.fn<() => void>();

    await run(defineCommand({ name: "app", action }), { argv: ["--help"] });

    expect(action).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage: app"));
  });

  it("prints the version without running the action for --version", async () => {
    const action = vi.fn<() => void>();

    await run(defineCommand({ name: "app", action }), { argv: ["--version"], version: "1.2.3" });

    expect(action).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("1.2.3");
  });
});

describe("run: command without an action", () => {
  it("prints help to stdout and exits 0 for a leaf command", async () => {
    // The built-in completions command would make the root a group, so opt out.
    await run(defineCommand({ name: "app" }), { argv: [], completions: false });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage: app"));
    expect(process.exitCode).toBe(0);
  });

  it("prints usage to stderr, not stdout, and exits 2 for a group command", async () => {
    const sub = defineCommand({ name: "child", action: noop });

    await run(defineCommand({ name: "app", commands: [sub] }), { argv: [] });

    expect(stderr()).toContain("Usage: app");
    expect(logSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
  });
});

describe("run: invalid arguments", () => {
  it("prints the issues and a usage hint, and exits 2 without running the action", async () => {
    const action = vi.fn<() => void>();
    const cmd = defineCommand({ name: "app", options: { verbose: { type: "boolean" } }, action });

    await run(cmd, { argv: ["--verbos"] });

    expect(action).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr()).toContain("unknown option");
    expect(stderr()).toContain('Run "app --help" for usage.');
  });

  it.each([
    ["1 problem", ["--verbos", "x"]],
    ["2 problems", ["--verbos"]],
  ])("reports %s", async (summary, argv) => {
    const cmd = defineCommand({
      name: "app",
      options: { verbose: { type: "boolean" } },
      positionals: { file: { required: true } },
    });

    await run(cmd, { argv });

    expect(stderr()).toContain(`app: ${summary}\n`);
  });
});

describe("run: did-you-mean", () => {
  const sub = defineCommand({ name: "build", action: noop });
  const cmd = defineCommand({
    name: "app",
    options: {
      verbose: { type: "boolean" },
      mode: { choices: ["dev", "prod"] },
      times: { type: "number" },
      shout: { type: "boolean" },
    },
    commands: [sub],
  });
  const withPositional = defineCommand({
    name: "app",
    positionals: { mode: { choices: ["dev", "prod"], required: true } },
    action: noop,
  });

  it.each([
    ["an unknown option", cmd, ["--verbos"], "--verbose"],
    ["an unexpected positional", cmd, ["buidl"], "build"],
    ["an invalid option choice", cmd, ["--mode=dvv"], "dev"],
    ["an invalid positional choice", withPositional, ["dvv"], "dev"],
  ])("suggests a match for %s", async (_label, root, argv, hint) => {
    await run(root, { argv });

    expect(stderr()).toContain(`did you mean ${hint}?`);
  });

  it("suggests a choice for a positional named like an Object.prototype member", async () => {
    const root = defineCommand({
      name: "app",
      positionals: { constructor: { choices: ["alpha", "beta"], required: true } },
      action: noop,
    });

    await run(root, { argv: ["alpa"] });

    expect(stderr()).toContain("did you mean alpha?");
  });

  it.each([
    ["nothing is close enough", cmd, ["--zzz"]],
    ["the issue has no offending value", withPositional, []],
    ["there are no subcommands to suggest", defineCommand({ name: "app" }), ["extra"]],
  ])("adds no hint when %s", async (_label, root, argv) => {
    await run(root, { argv });

    expect(stderr()).not.toContain("did you mean");
  });

  it("hints every unrelated unknown-option typo, not just the first", async () => {
    await run(cmd, { argv: ["--tims", "3", "--shuot"] });

    expect(stderr()).toContain("did you mean --times?");
    expect(stderr()).toContain("did you mean --shout?");
  });

  it("hints only once when a mistyped subcommand cascades into several unexpected positionals", async () => {
    const root = defineCommand({
      name: "app",
      commands: [defineCommand({ name: "commit", action: noop })],
    });

    await run(root, { argv: ["comit", "y"] });

    expect(stderr().split("did you mean")).toHaveLength(2);
  });
});

describe("run: action failure", () => {
  it.each([
    [
      "a thrown Error",
      () => {
        throw new Error("boom");
      },
      "boom",
    ],
    ["a rejected promise", () => Promise.reject(new Error("boom")), "boom"],
    [
      "a non-Error throw",
      () => {
        throw "plain string";
      },
      "plain string",
    ],
  ])("reports %s and exits 1", async (_label, action, message) => {
    await run(defineCommand({ name: "app", action }), { argv: [] });

    expect(errorSpy).toHaveBeenCalledWith(`app failed: ${message}`);
    expect(process.exitCode).toBe(1);
  });

  it.each([
    ["omits", undefined, 1],
    ["prints", "1", 2],
  ])("%s the stack trace when DEBUG is %j", async (_label, debug, calls) => {
    if (debug) process.env.DEBUG = debug;
    const action = () => {
      throw new Error("boom");
    };

    await run(defineCommand({ name: "app", action }), { argv: [] });

    expect(errorSpy).toHaveBeenCalledTimes(calls);
  });
});

describe("run: completions", () => {
  const app = () => defineCommand({ name: "my-app", action: noop });
  const printed = () => String(logSpy.mock.calls[0]?.[0]);

  it.each(["bash", "fish", "zsh"])("prints the %s completion script", async (shell) => {
    await run(app(), { argv: ["completions", shell] });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(printed()).toContain("my-app");
    expect(process.exitCode).toBeUndefined();
  });

  it("lists the command in the root help without the activation commands", async () => {
    await run(app(), { argv: ["--help"] });

    expect(printed()).toContain("Generate a shell completion script");
    expect(printed()).not.toContain("eval");
  });

  it("shows how to enable each shell's completions in the completions help", async () => {
    await run(app(), { argv: ["completions", "--help"] });

    expect(printed()).toContain('eval "$(my-app completions bash)"');
    expect(printed()).toContain("my-app completions fish | source");
    expect(printed()).toContain("source <(my-app completions zsh)");
  });

  it("describes a shell subcommand briefly in its own help", async () => {
    await run(app(), { argv: ["completions", "bash", "--help"] });

    expect(printed()).toContain("Generate the bash completion script");
    expect(printed()).not.toContain("eval");
  });

  it("suggests the nearest shell for a mistyped one", async () => {
    await run(app(), { argv: ["completions", "fsh"] });

    expect(process.exitCode).toBe(2);
    expect(stderr()).toContain("did you mean fish?");
  });

  it("does not mutate the command it was given", async () => {
    const cmd = app();

    await run(cmd, { argv: ["completions", "bash"] });

    expect(cmd.commands).toHaveLength(0);
  });

  it.each([
    ["a command", defineCommand({ name: "completions", action: noop })],
    ["an alias", defineCommand({ name: "gen", alias: ["completions"], action: noop })],
  ])("rejects a root that already defines %s named completions", async (_label, sub) => {
    const cmd = defineCommand({ name: "app", commands: [sub] });

    await expect(run(cmd, { argv: [] })).rejects.toMatchObject({ code: "ERR_RESERVED_NAME" });
  });

  it("lets an app define its own completions command when built-in completions are off", async () => {
    const action = vi.fn<() => void>();
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
