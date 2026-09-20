# Advanced usage

## Multi-file layout

A command is plain data, so a subcommand can be defined in its own module, exported as a value, and collected by the parent.

```ts
// commands/commit.ts
import { defineCommand } from "yalp-js";

export const commitCmd = defineCommand({
  name: "commit",
  description: "Record staged changes",
  options: { message: { short: "m", required: true, description: "Commit message" } },
  action: ({ options }) => console.log(`Commit: "${options.message}"`),
});
```

```ts
// cli.ts
import { defineCommand, run } from "yalp-js";
import { addCmd } from "./commands/add.ts";
import { commitCmd } from "./commands/commit.ts";

const cli = defineCommand({
  name: "git-lite",
  description: "A minimal slice of git",
  commands: [addCmd, commitCmd],
});

await run(cli, { version: "1.0.0" });
```

The [`git-lite` example](../examples/git-lite) is a complete version of this layout.

## Testing

`run` reads `process.argv` unless `argv` is passed. A test passes its own array and reads `process.exitCode` afterward:

```ts
import { run } from "yalp-js";
import { cli } from "./cli.ts";

await run(cli, { argv: ["Ada", "--shout"] });
console.log(process.exitCode); // undefined on success, 1 or 2 on failure
```

`run` writes with `console.log` and `console.error`, which can be spied on to inspect output. `process.exitCode` persists between calls and is reset by the test.

## Exit codes from actions

`run` sets `process.exitCode` only on failure. An action sets any other code directly:

```ts
action: () => {
  process.exitCode = 3;
},
```

## Handling parsing directly

`parse` takes the root command and an array of arguments and returns a result. It prints nothing, runs no action, and does not throw on invalid user input.

```ts
import { defineCommand, parse } from "yalp-js";

const cmd = defineCommand({
  name: "greet-raw",
  positionals: { name: { required: true } },
  options: { loud: { type: "boolean", short: "l" } },
});

const result = parse(cmd, process.argv.slice(2));

if (!result.ok) {
  for (const issue of result.issues) console.error(`error: ${issue.message}`);
  process.exitCode = 2;
} else if (result.kind === "help") {
  console.log("Help requested");
} else if (result.kind === "version") {
  console.log("Version requested");
} else {
  const name = String(result.positionals.name);
  console.log(result.options.loud ? name.toUpperCase() : name);
}
```

`parse` does not add the built-in `completions` command and does not call the action. The caller invokes `result.command.action` when the action should run.

### Result

`parse` returns one of four shapes. `ok` is checked first, then `kind`.

| Shape                            | Meaning                                                     |
| -------------------------------- | ----------------------------------------------------------- |
| `{ ok: true, kind: "run", ... }` | Valid arguments. Adds `options`, `positionals`, and `rest`. |
| `{ ok: true, kind: "help" }`     | Help was requested.                                         |
| `{ ok: true, kind: "version" }`  | The version was requested.                                  |
| `{ ok: false, issues }`          | The arguments were invalid. `issues` lists every problem.   |

Every shape includes `command`, the command the arguments reached, and `path`, the command names from the root to that command.

The `version` shape occurs only when `{ version: true }` is passed as the third argument. Without it, `-V` and `--version` are unknown options.

### Issues

An issue has a `code`, a `message`, and, when applicable, `param` (the parameter name) and `value` (the offending word).

| Code                        | Meaning                                             |
| --------------------------- | --------------------------------------------------- |
| `ERR_UNKNOWN_OPTION`        | The word is not an option of the command.           |
| `ERR_MISSING_VALUE`         | An option that takes a value is the last argument.  |
| `ERR_UNEXPECTED_VALUE`      | A boolean flag was given a value, as in `--flag=1`. |
| `ERR_UNEXPECTED_POSITIONAL` | A word does not fit any positional.                 |
| `ERR_MISSING_REQUIRED`      | A required parameter is missing.                    |
| `ERR_INVALID_NUMBER`        | A `number` parameter received text that is not one. |
| `ERR_INVALID_CHOICE`        | A value is not among the parameter's `choices`.     |

The [`parse-manual` example](../examples/parse-manual) is a runnable version of the snippet above.
