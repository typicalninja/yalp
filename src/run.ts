import type { Command } from "./command.js";
import { rootWithCompletionsCommand } from "./completions/generate.js";
import { help } from "./help.js";
import { parse, type Issue } from "./parse.js";
import { suggest } from "./suggest.js";

/** Options for {@link run}. */
export interface RunOptions {
  /**
   * Arguments to parse.
   *
   * @default process.argv.slice(2)
   */
  argv?: string[];
  /** Version printed by `-V` and `--version`. Omitted: the flags are disabled. */
  version?: string;
  /**
   * Adds the built-in `completions` command.
   *
   * @default true
   */
  completions?: boolean;
}

/**
 * Parses arguments, prints help or errors, and runs the matched command's action.
 *
 * Sets `process.exitCode` and returns. The code is 1 when the action throws, and 2 for invalid
 * arguments or a command with subcommands run without one.
 *
 * @example
 *   await run(cli, { version: "1.0.0" });
 *
 * @param root - The root command.
 * @param options - Run options.
 * @returns A promise that settles after the action has finished.
 * @throws {ConfigError} With code `ERR_RESERVED_NAME` when `root` defines a command or alias named
 *   `completions` and the built-in command is enabled.
 */
export async function run(root: Command, options: RunOptions = {}): Promise<void> {
  const { argv = process.argv.slice(2), version, completions = true } = options;
  const effectiveRoot = completions ? rootWithCompletionsCommand(root) : root;
  const result = parse(effectiveRoot, argv, { version: Boolean(version) });

  if (!result.ok) {
    console.error(format(result.command, result.path, result.issues));
    console.error(`\nRun "${result.path.join(" ")} --help" for usage.`);
    process.exitCode = 2;
    return;
  }
  if (result.kind === "version") {
    console.log(version);
    return;
  }
  if (result.kind === "help") {
    console.log(help(result.command, result.path, version));
    return;
  }

  const { command, path } = result;
  if (!command.action) {
    const usage = help(command, path, version);
    // A group command with no action is a usage error; a leaf with none is a no-op.
    if (command.commands.length) {
      console.error(usage);
      process.exitCode = 2;
    } else {
      console.log(usage);
      process.exitCode = 0;
    }
    return;
  }

  try {
    await command.action({
      options: result.options,
      positionals: result.positionals,
      rest: result.rest,
    });
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    console.error(`${path.join(" ")} failed: ${cause.message}`);
    if (cause.stack && process.env.DEBUG) console.error(cause.stack);
    process.exitCode = 1;
  }
}

function format(command: Command, path: string[], issues: Issue[]): string {
  const lines = [`${path.join(" ")}: ${issues.length} problem${issues.length > 1 ? "s" : ""}`, ""];
  // An unresolved subcommand and its trailing words all surface as unexpected positionals; only the
  // first gets a hint.
  let positionalHinted = false;

  for (const issue of issues) {
    lines.push(`  ✗ ${issue.message}`);
    if (issue.code === "ERR_UNEXPECTED_POSITIONAL" && positionalHinted) continue;

    const hint = tip(command, issue);
    if (hint) {
      lines.push(`    did you mean ${hint}?`);
      if (issue.code === "ERR_UNEXPECTED_POSITIONAL") positionalHinted = true;
    }
  }
  return lines.join("\n");
}

function tip(command: Command, issue: Issue): string | undefined {
  const { value } = issue;
  if (!value) return undefined;

  if (issue.code === "ERR_UNKNOWN_OPTION") {
    const match = suggest(value, Object.keys(command.options));
    return match && `--${match}`;
  }
  if (issue.code === "ERR_UNEXPECTED_POSITIONAL" && command.commands.length) {
    return suggest(
      value,
      command.commands.flatMap((c) => [c.name, ...c.alias]),
    );
  }
  if (issue.code === "ERR_INVALID_CHOICE" && issue.param) {
    const param = Object.hasOwn(command.options, issue.param)
      ? command.options[issue.param]
      : command.positionals.find((p) => p.name === issue.param);
    return suggest(value, (param?.choices ?? []).map(String));
  }
  return undefined;
}
