import { describe, expect, it } from "vitest";

import { defineCommand } from "../src/command.js";
import { help } from "../src/help.js";

describe("help: usage line", () => {
  it("renders the bare command name with no options, commands, or positionals", () => {
    const cmd = defineCommand({ name: "app" });
    expect(help(cmd, ["app"])).toContain("Usage: app");
  });

  it("adds [command] when subcommands exist", () => {
    const cmd = defineCommand({ name: "app", commands: [defineCommand({ name: "sub" })] });
    expect(help(cmd, ["app"])).toContain("Usage: app [command]");
  });

  it("adds [options] when options exist", () => {
    const cmd = defineCommand({ name: "app", options: { env: {} } });
    expect(help(cmd, ["app"])).toContain("Usage: app [options]");
  });

  it("renders a required positional as <name> and an optional one as [name]", () => {
    const cmd = defineCommand({
      name: "app",
      positionals: { file: { required: true }, tag: {} },
    });
    expect(help(cmd, ["app"])).toContain("Usage: app <file> [tag]");
  });

  it("appends '...' to a variadic positional slot", () => {
    const cmd = defineCommand({ name: "app", positionals: { files: { multiple: true } } });
    expect(help(cmd, ["app"])).toContain("Usage: app [files...]");
  });

  it("joins a multi-level path for nested subcommands", () => {
    const cmd = defineCommand({ name: "sub" });
    expect(help(cmd, ["app", "sub"])).toContain("Usage: app sub");
  });
});

describe("help: sections", () => {
  it("includes the description when present", () => {
    const cmd = defineCommand({ name: "app", description: "does things" });
    expect(help(cmd, ["app"])).toContain("does things");
  });

  it("lists subcommands with their aliases and descriptions", () => {
    const cmd = defineCommand({
      name: "app",
      commands: [defineCommand({ name: "run", alias: ["r"], description: "runs it" })],
    });
    const output = help(cmd, ["app"]);
    expect(output).toContain("Commands:");
    expect(output).toContain("run, r");
    expect(output).toContain("runs it");
  });

  it("shows only the first line of a multi-line subcommand description in the parent's table", () => {
    const sub = defineCommand({ name: "sub", description: "summary line\n\ndetail line" });
    const output = help(defineCommand({ name: "app", commands: [sub] }), ["app"]);
    expect(output).toContain("summary line");
    expect(output).not.toContain("detail line");
  });

  it("prints a multi-line description in full in the command's own help", () => {
    const sub = defineCommand({ name: "sub", description: "summary line\n\ndetail line" });
    expect(help(sub, ["app", "sub"])).toContain("summary line\n\ndetail line");
  });

  it("lists positionals with choices and default/required notes", () => {
    const cmd = defineCommand({
      name: "app",
      positionals: {
        file: { required: true },
        mode: { choices: ["dev", "prod"], default: "dev" },
      },
    });
    const output = help(cmd, ["app"]);
    expect(output).toContain("Arguments:");
    expect(output).toContain("(dev | prod)");
    expect(output).toContain("(default: dev)");
    expect(output).toContain("(required)");
  });

  it("lists examples under an Examples section, prefilling the command path", () => {
    const cmd = defineCommand({
      name: "app",
      examples: ["build --watch", "deploy prod"],
    });
    const output = help(cmd, ["app"]);
    expect(output).toContain("Examples:");
    expect(output).toContain("app build --watch");
    expect(output).toContain("app deploy prod");
  });

  it("includes a note alongside an example given as an [args, note] tuple", () => {
    const cmd = defineCommand({
      name: "app",
      examples: [["build --watch", "rebuild on file changes"]],
    });
    const output = help(cmd, ["app"]);
    expect(output).toContain("app build --watch");
    expect(output).toContain("rebuild on file changes");
  });

  it("prefills the full nested path for a subcommand's examples", () => {
    const cmd = defineCommand({ name: "sub", examples: ["--force"] });
    expect(help(cmd, ["app", "sub"])).toContain("app sub --force");
  });

  it("omits the Examples section when no examples are given", () => {
    const cmd = defineCommand({ name: "app" });
    expect(help(cmd, ["app"])).not.toContain("Examples:");
  });

  it("includes a positional's own description alongside its other notes", () => {
    const cmd = defineCommand({
      name: "app",
      positionals: { file: { required: true, description: "the input file" } },
    });
    expect(help(cmd, ["app"])).toContain("the input file");
  });

  it("renders a short flag column and marks a boolean option as --[no-]name", () => {
    const cmd = defineCommand({
      name: "app",
      options: { verbose: { type: "boolean", short: "v" }, env: {} },
    });
    const output = help(cmd, ["app"]);
    expect(output).toContain("-v, --[no-]verbose");
    expect(output).toContain("--env <value>");
  });

  it("marks a repeatable non-boolean option with <value...>", () => {
    const cmd = defineCommand({ name: "app", options: { tag: { multiple: true } } });
    expect(help(cmd, ["app"])).toContain("--tag <value...>");
  });

  it("pads a boolean option's short-flag column when it has no short flag", () => {
    const cmd = defineCommand({ name: "app", options: { verbose: { type: "boolean" } } });
    expect(help(cmd, ["app"])).toContain("    --[no-]verbose");
  });

  it("always includes the -h, --help row", () => {
    const cmd = defineCommand({ name: "app" });
    expect(help(cmd, ["app"])).toContain("-h, --help");
  });

  it("includes -V, --version only at the root when a version string is given", () => {
    const cmd = defineCommand({ name: "app" });
    expect(help(cmd, ["app"], "1.0.0")).toContain("-V, --version");
  });

  it("omits -V, --version when no version string is given", () => {
    const cmd = defineCommand({ name: "app" });
    expect(help(cmd, ["app"])).not.toContain("-V, --version");
  });

  it("omits -V, --version for a nested subcommand even with a version string", () => {
    const sub = defineCommand({ name: "sub" });
    expect(help(sub, ["app", "sub"], "1.0.0")).not.toContain("-V, --version");
  });
});

describe("help: description wrapping", () => {
  it("wraps a long description onto multiple lines under stdout.columns width", () => {
    const columns = Object.getOwnPropertyDescriptor(process.stdout, "columns");
    Object.defineProperty(process.stdout, "columns", { value: 60, configurable: true });
    try {
      const cmd = defineCommand({
        name: "app",
        options: {
          env: {
            description:
              "sets the deployment environment used to pick config, secrets, and endpoints",
          },
        },
      });
      const lines = help(cmd, ["app"]).split("\n");
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(60);
      expect(lines.some((l) => l.includes("sets the deployment"))).toBe(true);
      expect(lines.some((l) => l.trim().startsWith("pick config"))).toBe(true);
    } finally {
      if (columns) Object.defineProperty(process.stdout, "columns", columns);
      else delete (process.stdout as { columns?: number }).columns;
    }
  });

  it("leaves a description unwrapped when the terminal is too narrow to wrap usefully", () => {
    const columns = Object.getOwnPropertyDescriptor(process.stdout, "columns");
    Object.defineProperty(process.stdout, "columns", { value: 10, configurable: true });
    try {
      const cmd = defineCommand({
        name: "app",
        options: { env: { description: "sets the deployment environment" } },
      });
      expect(help(cmd, ["app"])).toContain("sets the deployment environment");
    } finally {
      if (columns) Object.defineProperty(process.stdout, "columns", columns);
      else delete (process.stdout as { columns?: number }).columns;
    }
  });

  it("splits a single word longer than the available width instead of overflowing", () => {
    const columns = Object.getOwnPropertyDescriptor(process.stdout, "columns");
    Object.defineProperty(process.stdout, "columns", { value: 70, configurable: true });
    try {
      const cmd = defineCommand({
        name: "app",
        options: {
          env: {
            description:
              "see https://example.com/a-very-long-url-that-cannot-fit-on-one-line-at-all-really",
          },
        },
      });
      const lines = help(cmd, ["app"]).split("\n");
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(70);
    } finally {
      if (columns) Object.defineProperty(process.stdout, "columns", columns);
      else delete (process.stdout as { columns?: number }).columns;
    }
  });
});
