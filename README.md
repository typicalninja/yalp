# yalp

Yet another command-line parser. An opinionated, type-preserving CLI toolkit for JavaScript and
TypeScript.

## Features

- **End-to-end type inference:** Option and positional types come from the builder chain. For example,
  `.number().default(0)` reaches your action as `number`, and an optional `.string()` becomes
  `string | undefined`.
- **Conventional argument syntax:** `--name value`, `--name=value`, `-n value`, `-nvalue`,
  `-n=value`, clustered short options such as `-abc` and `-xvfFile.png`, boolean negation with
  `--no-name`, and `--` to pass the remaining arguments through.
- **Built-in `-h` / `--help` and `-V` / `--version`.**
- **ESM only, zero runtime dependencies, Node.js 22 or later, and Bun.**

## Requirements

- Node.js 22 or later, or a compatible runtime such as Bun.
- An ESM project. yalp has no CommonJS build.

## Install

```sh
npm install yalp
pnpm add yalp
yarn add yalp
```

## Quick start

```js
import { app, command } from "yalp";

const greet = command("greet", "Greet someone")
  .option("name", (o) => o.string().default("world"))
  .option("loud", (o) => o.boolean().default(false))
  .action(({ options }) => {
    const message = `Hello, ${options.name}!`;
    console.log(options.loud ? message.toUpperCase() : message);
  });

const cli = app("demo", "A small example CLI").version("1.0.0").command(greet);

process.exitCode = await cli.run(process.argv.slice(2));
```

```console
$ demo greet --name Ada --loud
HELLO, ADA!
```

## Define options

Call `.option(name, configure)`. The `name` is lowercase kebab-case and becomes `--name`. The
`configure` callback receives a parameter builder. Set the kind first, then the modifiers:

```js
command("build")
  .option("out", (o) => o.string().required().short("o").description("Output directory"))
  .option("jobs", (o) => o.number().default(4))
  .option("define", (o) => o.string().multiple())
  .option("minify", (o) => o.boolean().default(false))
  .action(({ options }) => {
    // options.out    -> string
    // options.jobs   -> number
    // options.define -> string[]
    // options.minify -> boolean
  });
```

An optional option with no default resolves to `value | undefined`.

## Define positional arguments

Call `.positional(name, configure)`. yalp binds positionals to argument slots in registration
order, and matches subcommands before positionals.

```js
command("copy")
  .positional("source", (p) => p.string().required())
  .positional("dest", (p) => p.string().required())
  .positional("extra", (p) => p.string().multiple())
  .action(({ positionals }) => {
    // positionals.source -> string
    // positionals.dest   -> string
    // positionals.extra  -> string[]
  });
```

A required positional cannot follow an optional one, and no positional can follow a `.multiple()`
positional.

## Add subcommands

Pass a configured command to `.command()`. Use `.alias()` for alternate names.

```js
import { app, command } from "yalp";

const remote = command("remote", "Manage remotes")
  .command(
    command("add", "Add a remote")
      .alias(["a"])
      .action(({ rest }) => {}),
  )
  .command(command("remove", "Remove a remote").action(({ rest }) => {}));

const cli = app("git-lite").command(remote);
```

Every command must have an action, subcommands, or both. If a command has subcommands but no
action and the user invokes it directly, yalp prints help and `run()` resolves to `2`.

## Supported syntax

| Form              | Meaning                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| `--name value`    | An option and its value as separate tokens.                                    |
| `--name=value`    | An option and its value in one token.                                          |
| `-n value`        | A short option and its value as separate tokens.                               |
| `-nvalue`         | A short option with its value attached. `-n=value` also works.                 |
| `-abc`            | A cluster of boolean short options, equal to `-a -b -c`.                       |
| `-abcvalue`       | A cluster whose last option takes a value, equal to `-a -b -c value`.          |
| `--no-name`       | The negated form of a boolean option. Sets it to `false`.                      |
| `--`              | Ends option parsing. Later tokens fill any remaining positionals, then `rest`. |
| `-`               | A literal argument, not an option.                                             |
| `-h`, `--help`    | Prints help for the current command. Works at any level, before `--`.          |
| `-V`, `--version` | Prints the version. Root only, and only as the single argument.                |

Options and positionals can be interleaved. yalp reads options anywhere up to `--`.

The names `help` and `h` are reserved on every command. The names `version` and `V` are reserved
on the root. A short name is a single ASCII letter.

### Deviations from convention

yalp follows the GNU and Git style for the common cases. It differs in these places:

- **A separate token that looks like an option is never consumed as a value.** `--name --other`
  is an error, not `name = "--other"`. Write `--name=--other` or `-n--other`. The one exception
  is a negative number for a `number` option, such as `--count -5`. Git's `parse-options` and
  `getopt` take the next token as-is.
- **Repeating an option that is not `.multiple()` is an error.** Most tools keep the last value.
- **`-V` and `--version` are recognized only as the sole argument** to the root command.

## Handle errors

For an expected, user-facing failure, throw `CliError`. yalp writes `error: <message>` to stderr
and resolves `run()` with the error's exit code.

```js
import { CliError } from "yalp";

command("deploy").action(async () => {
  throw new CliError("could not reach the server", { exitCode: 3 });
});
```

If an action throws any other error, it propagates out of `run()`.
