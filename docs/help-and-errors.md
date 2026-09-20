# Help and errors

`run` produces the help text, version output, and error reports of a CLI, and sets the exit code. [`parse()`](./advanced.md#handling-parsing-directly) provides the same parsing without this output.

## Help

Every command answers `-h` and `--help`. The text is built from the definition, in this order:

1. `Usage:` line.
2. The command's `description`.
3. `Commands:`, when the command has subcommands.
4. `Arguments:`, when the command has positionals.
5. `Options:`, always, because `-h, --help` is always listed.
6. `Examples:`, when the command has `examples`.

```
Usage: git-lite commit [options]

Record staged changes.

Options:
  -m, --message <value>     Commit message (required)
      --[no-]amend          Amend the previous commit
      --[no-]verify         Run pre-commit hooks (disable with --no-verify)
                            (default: true)
      --trailer <value...>  Append a trailer line, e.g. 'Reviewed-by: name'
                            (repeatable)
  -h, --help                Show this help
```

Notation:

- `--[no-]name`: a boolean option that also accepts `--no-name`.
- `<value...>`: an option with `multiple: true`.
- `(required)`, `(default: x)`, `(one | two)`: the `required`, `default`, and `choices` settings.

The description column wraps to the terminal width, read from `process.stdout.columns` with a fallback of 80. The command's own `description` is printed as written.

A `description` can span several lines. A parent's `Commands:` table shows only the first line of each subcommand's description. The subcommand's own help shows all of it.

## Version

The `version` option of `run` enables `-V` and `--version` on the root command:

```ts
await run(cli, { version: "1.4.0" });
```

```sh
$ my-app --version
1.4.0
```

Subcommands have no version flag. The root help lists `-V, --version` only when `version` is passed.

## Errors

For invalid arguments, `run` writes every problem found, followed by a pointer to the help, to standard error and exits with status 2.

```
git-lite commit: 4 problems

  ✗ "--amend" is a flag, use --amend or --no-amend
  ✗ unknown option "--mesage"
    did you mean --message?
  ✗ "message" is required
  ✗ unexpected argument "x"

Run "git-lite commit --help" for usage.
```

The first line names the command reached, which is the command whose rules were violated.

### Suggestions

A `did you mean` line is added when the offending word is close to a valid one, ignoring case.
Suggestions cover:

- Option names, for an unknown option: `unknown option "--mesage"` suggests `--message`.
- Subcommand names and aliases, for an unexpected word on a command that has subcommands.
- Choices, for a value outside `choices`.

```
$ git-lite branch --sort refnam
git-lite branch: 1 problem

  ✗ "sort" must be one of: refname, committerdate
    did you mean refname?
```

An exact match is never suggested. When one mistyped subcommand also leaves the following words unexpected, a single suggestion is shown.

## Exit codes

`run` sets `process.exitCode` and returns. It never calls `process.exit`.

| Code | Meaning                                                                       |
| ---- | ----------------------------------------------------------------------------- |
| 0    | The action finished, or help or the version was printed.                      |
| 1    | The action threw or rejected. `<command path> failed: <message>` was printed. |
| 2    | The arguments were invalid, or a group command was run without a subcommand.  |

When the environment variable `DEBUG` is set, the stack trace of a failed action is printed as well.

## Definition errors

`defineCommand` throws a `ConfigError` for an invalid definition. The error's `code` identifies the rule:

| Code                           | Cause                                                                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ERR_INVALID_NAME`             | A command, alias, option, or positional name is not kebab-case, or a `short` is not one letter.                                                                   |
| `ERR_RESERVED_NAME`            | An option named `help` or `version`, an option starting with `no-`, or a `short` of `h` or `V`. Also thrown by `run` when the root command defines `completions`. |
| `ERR_DUPLICATE_SUBCOMMAND`     | Two sibling commands share a name or alias.                                                                                                                       |
| `ERR_DUPLICATE_OPTION`         | Two options of one command share a `short`.                                                                                                                       |
| `ERR_INVALID_POSITIONAL_ORDER` | A required positional follows an optional one, or any positional follows a variadic one.                                                                          |
| `ERR_INVALID_PARAM`            | The fields of a parameter contradict each other. See [Contradictory declarations](./options-and-positionals.md#contradictory-declarations).                       |

```ts
import { ConfigError, defineCommand } from "yalp-js";

try {
  defineCommand({ name: "Build" });
} catch (error) {
  if (error instanceof ConfigError) console.error(error.code, error.message);
  // ERR_INVALID_NAME command "Build" must be kebab-case
}
```

`ConfigError` extends `YalpError`, the base class of every error yalp throws.
