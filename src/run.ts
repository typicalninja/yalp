import type { Command } from "./command.js";
import { rootWithCompletionsCommand } from "./completions/generate.js";
import { help } from "./help.js";
import { parse, type Issue } from "./parse.js";
import { suggest } from "./suggest.js";

/** Options for {@link run}. */
export interface RunOptions {
  /** Arguments to parse. Defaults to `process.argv.slice(2)`. */
  argv?: string[];
  /** Enables -V / --version on the root command. Omit to disable. */
  version?: string;
  /** Adds the built-in `completions` command. Defaults to `true`. */
  completions?: boolean;
}

/** Parses argv, prints help or errors, runs the matched action. Sets process.exitCode. */
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
  // Only ERR_UNEXPECTED_POSITIONAL cascades from one root typo (an unresolved
  // subcommand's own name, plus everything after it, both fall through as
  // extra positionals); other codes are independent mistakes and each earn
  // their own hint.
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
    const param =
      command.options[issue.param] ?? command.positionals.find((p) => p.name === issue.param);
    return suggest(value, (param?.choices ?? []).map(String));
  }
  return undefined;
}
