# Commands

A command is the unit of a CLI: a name, its parameters, an optional action, and optional subcommands.

## Definition

`defineCommand` takes a configuration object and returns the command.

```ts
import { defineCommand } from "yalp-js";

const build = defineCommand({
  name: "build",
  description: "Compile the project",
  alias: ["b"],
  options: { watch: { type: "boolean", short: "w", description: "Rebuild on change" } },
  positionals: { entry: { description: "Entry file", default: "src/index.ts" } },
  examples: ["--watch", ["src/main.ts", "build a different entry"]],
  action: ({ options, positionals }) => {
    console.log(`building ${positionals.entry}`, options.watch ? "(watching)" : "");
  },
});
```

| Field         | Type                 | Description                                                   |
| ------------- | -------------------- | ------------------------------------------------------------- |
| `name`        | `string`             | Required. The word that selects the command.                  |
| `description` | `string`             | Help text.                                                    |
| `alias`       | `readonly string[]`  | Alternative names.                                            |
| `options`     | object               | Named parameters. See [Options and positionals][params].      |
| `positionals` | object               | Ordered parameters. See [Options and positionals][params].    |
| `commands`    | `readonly Command[]` | Subcommands.                                                  |
| `action`      | function             | The handler. See [Actions](#actions).                         |
| `examples`    | `readonly Example[]` | Sample invocations listed in help. See [Examples](#examples). |

[params]: ./options-and-positionals.md

The array fields accept `readonly` arrays, so values declared `as const` are valid. The command keeps its own copy of each array.

A command is plain data. `defineCommand` validates it and returns a readonly object. Commands can be stored in arrays, exported from modules, and reused in several parents.

### Names

Command names and aliases are kebab-case: lowercase letters and digits joined by single hyphens, starting with a letter. `build`, `dry-run`, and `v2` are valid. `Build`, `dry_run`, and `-x` are
not.

`defineCommand` validates each definition when it runs and throws a `ConfigError` for a violation. The error surfaces when the module loads. See
[Definition errors](./help-and-errors.md#definition-errors) for the error codes.

## Actions

The `action` function receives one object:

| Property      | Contents                                                  |
| ------------- | --------------------------------------------------------- |
| `options`     | Parsed options, keyed by option name.                     |
| `positionals` | Parsed positional arguments, keyed by positional name.    |
| `rest`        | The arguments after a literal `--`, as strings, in order. |

```ts
const echo = defineCommand({
  name: "echo",
  action: ({ rest }) => {
    console.log(rest.join(" "));
  },
});
```

An action can be `async`, and `run` waits for it. The return value is ignored.

When an action throws or rejects, `run` prints `<command path> failed: <message>`, sets the exit code to 1, and returns. `run` never calls `process.exit`. When the environment variable `DEBUG` is
set, the stack trace is printed as well.

```sh
$ node cli.mjs deploy
my-app deploy failed: no credentials found
$ echo $?
1
```

## Subcommands

Subcommands are listed in `commands`. A subcommand can have subcommands of its own, to any depth.

```ts
import { defineCommand, run } from "yalp-js";

const list = defineCommand({
  name: "list",
  description: "List remotes",
  action: () => console.log("origin"),
});

const add = defineCommand({
  name: "add",
  description: "Add a remote",
  positionals: { name: { required: true }, url: { required: true } },
  action: ({ positionals }) => console.log(`added ${positionals.name}`),
});

const remote = defineCommand({
  name: "remote",
  description: "Manage remotes",
  commands: [list, add],
});

const cli = defineCommand({ name: "git-lite", commands: [remote] });

await run(cli);
```

```sh
$ git-lite remote add origin https://example.com/repo.git
added origin
```

### Command resolution

Arguments are read from the left. Each word that names a subcommand of the current command selects that subcommand. The first word that does not ends the search, and every later word belongs to the command reached so far.

Consequences:

- Subcommand names precede all options. Even when the root command declares a `--verbose` flag, `git-lite --verbose remote` fails with `unexpected argument "remote"`, because `--verbose` ends the search at the root command.
- Options are not inherited. An option belongs to the command that declares it. `--verbose` on `remote add` requires a declaration on `add`.

### Commands without an action

- A command with subcommands and no `action` is a group. Running a group directly prints its help to standard error and exits with status 2.
- A command with subcommands and an `action` runs the action when no subcommand is given.
- A command with neither prints its help to standard output and exits with status 0. The root command is the exception, because `run` adds the built-in `completions` subcommand to it. See [Built-in commands](#built-in-commands).

## Aliases

`alias` assigns additional names to a command. Help lists them beside the command name.

```ts
const branch = defineCommand({
  name: "branch",
  alias: ["br"],
  description: "Create or list branches",
});
```

```
Commands:
  branch, br   Create or list branches
  completions  Generate a shell completion script
```

A name or alias is unique among sibling commands.

## Examples

`examples` lists sample invocations under `Examples:` in the command's help. An entry is either a string of arguments or an `[arguments, note]` pair. The command path is prepended to each entry.

```ts
const cli = defineCommand({
  name: "hello",
  examples: ["Ada --shout", ["Grace --times 3", "greet Grace three times"]],
});
```

```
Examples:
  hello Ada --shout
  hello Grace --times 3  greet Grace three times
```

## Built-in commands

`run` adds one command to the root command: `completions`, which prints a shell completion script. See [Shell completions](./shell-completions.md). A root command or alias named `completions` is rejected unless the built-in command is disabled with `run(cli, { completions: false })`.
