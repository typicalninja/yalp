import { describe, expect, it } from "vitest";

import { defineCommand } from "../src/command.js";
import { help } from "../src/help.js";

/** Runs `fn` with `process.stdout.columns` set to `columns`, restoring it afterwards. */
function withColumns<T>(columns: number, fn: () => T): T {
  const original = Object.getOwnPropertyDescriptor(process.stdout, "columns");
  Object.defineProperty(process.stdout, "columns", { value: columns, configurable: true });
  try {
    return fn();
  } finally {
    if (original) Object.defineProperty(process.stdout, "columns", original);
    else delete (process.stdout as { columns?: number }).columns;
  }
}

describe("help: usage line", () => {
  const sub = defineCommand({ name: "sub" });

  it.each([
    ["a bare command", defineCommand({ name: "app" }), "Usage: app\n"],
    ["subcommands", defineCommand({ name: "app", commands: [sub] }), "Usage: app [command]\n"],
    ["options", defineCommand({ name: "app", options: { env: {} } }), "Usage: app [options]\n"],
    [
      "required, optional, and variadic positionals",
      defineCommand({
        name: "app",
        positionals: { file: { required: true }, tag: {}, rest: { multiple: true } },
      }),
      "Usage: app <file> [tag] [rest...]\n",
    ],
  ])("renders %s", (_label, cmd, expected) => {
    expect(`${help(cmd, ["app"])}\n`).toContain(expected);
  });

  it("joins the full path for a nested subcommand", () => {
    expect(help(sub, ["app", "sub"])).toContain("Usage: app sub\n");
  });
});

describe("help: sections", () => {
  it("lists subcommands with aliases, showing only the first line of each description", () => {
    const cmd = defineCommand({
      name: "app",
      commands: [defineCommand({ name: "run", alias: ["r"], description: "runs it\n\ndetail" })],
    });
    const output = help(cmd, ["app"]);

    expect(output).toContain("Commands:");
    expect(output).toMatch(/run, r\s+runs it$/m);
    expect(output).not.toContain("detail");
  });

  it("prints a multi-line description in full in the command's own help", () => {
    const cmd = defineCommand({ name: "sub", description: "summary line\n\ndetail line" });
    expect(help(cmd, ["app", "sub"])).toContain("summary line\n\ndetail line");
  });

  it("lists positionals with their description, choices, and default or required note", () => {
    const cmd = defineCommand({
      name: "app",
      positionals: {
        file: { required: true, description: "the input file" },
        mode: { choices: ["dev", "prod"], default: "dev" },
      },
    });
    const output = help(cmd, ["app"]);

    expect(output).toContain("Arguments:");
    expect(output).toMatch(/<file>\s+the input file \(required\)$/m);
    expect(output).toMatch(/\[mode\]\s+\(dev \| prod\) \(default: dev\)$/m);
  });

  it("renders option flags by type, short form, and repeatability", () => {
    const cmd = defineCommand({
      name: "app",
      options: {
        verbose: { type: "boolean", short: "v" },
        quiet: { type: "boolean" },
        env: {},
        tag: { multiple: true },
      },
    });
    const output = help(cmd, ["app"]);

    expect(output).toContain("-v, --[no-]verbose");
    expect(output).toContain("    --[no-]quiet");
    expect(output).toContain("--env <value>");
    expect(output).toContain("--tag <value...>");
  });

  it("prefills the command path in examples, with an optional note", () => {
    const cmd = defineCommand({
      name: "sub",
      examples: ["--force", ["build --watch", "rebuild on file changes"]],
    });
    const output = help(cmd, ["app", "sub"]);

    expect(output).toContain("Examples:");
    expect(output).toContain("app sub --force");
    expect(output).toMatch(/app sub build --watch\s+rebuild on file changes$/m);
  });

  it("omits the Examples section when there are none", () => {
    expect(help(defineCommand({ name: "app" }), ["app"])).not.toContain("Examples:");
  });

  it.each([
    ["-h, --help", ["app"], undefined, true],
    ["-V, --version", ["app"], "1.0.0", true],
    ["-V, --version", ["app"], undefined, false],
    ["-V, --version", ["app", "sub"], "1.0.0", false],
  ])("shows the %s row for path %j, version %j: %s", (row, path, version, shown) => {
    const output = help(defineCommand({ name: "cmd" }), path, version);
    expect(output.includes(row)).toBe(shown);
  });
});

describe("help: description wrapping", () => {
  const helpWith = (description: string) =>
    help(defineCommand({ name: "app", options: { env: { description } } }), ["app"]);

  it("wraps a long description within stdout.columns", () => {
    const lines = withColumns(60, () =>
      helpWith("sets the deployment environment used to pick config, secrets, and endpoints").split(
        "\n",
      ),
    );

    expect(lines.every((line) => line.length <= 60)).toBe(true);
    expect(lines.some((l) => l.includes("sets the deployment"))).toBe(true);
    expect(lines.some((l) => l.trim().startsWith("pick config"))).toBe(true);
  });

  it("splits a single word longer than the available width instead of overflowing", () => {
    const lines = withColumns(70, () =>
      helpWith(
        "see https://example.com/a-very-long-url-that-cannot-fit-on-one-line-at-all-really",
      ).split("\n"),
    );

    expect(lines.every((line) => line.length <= 70)).toBe(true);
  });

  it("leaves a description unwrapped when the terminal is too narrow to wrap usefully", () => {
    const output = withColumns(10, () => helpWith("sets the deployment environment"));
    expect(output).toContain("sets the deployment environment");
  });
});
