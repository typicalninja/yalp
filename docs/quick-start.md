# Quick start

A first CLI in four steps: one command, an option, generated help, and subcommands.

## Installation

```sh
npm install yalp-js
pnpm add yalp-js
bun add yalp-js
```

Or from [JSR](https://jsr.io/@typical/yalp):

```sh
# deno
deno add jsr:@typical/yalp
# pnpm 10.9+
pnpm add jsr:@typical/yalp
# yarn 4.9+
yarn add jsr:@typical/yalp

# npm, bun, and older versions of yarn or pnpm
npx jsr add @typical/yalp # replace npx with any of yarn dlx, pnpm dlx, or bunx
```

Requirements: Node.js 22 or later, Deno, or Bun. `yalp` is an ES module and does not support `require()`.

## A single command

```js
import { defineCommand, run } from "yalp-js";

const cli = defineCommand({
  name: "greet",
  description: "Greet someone",
  positionals: {
    name: { description: "Who to greet", default: "World" },
  },
  action: ({ positionals }) => {
    console.log(`Hello, ${positionals.name}!`);
  },
});

await run(cli);
```

`defineCommand` validates the definition and returns it as a plain object. `run` parses `process.argv`, selects the matching command, and calls its `action`.

```sh
$ node cli.mjs Ada
Hello, Ada!
$ node cli.mjs
Hello, World!
```

## An option

A boolean option with a one-letter alias:

```js
const cli = defineCommand({
  name: "greet",
  description: "Greet someone",
  positionals: {
    name: { description: "Who to greet", default: "World" },
  },
  options: {
    shout: { type: "boolean", short: "s", description: "Uppercase the greeting" },
  },
  action: ({ positionals, options }) => {
    const greeting = `Hello, ${positionals.name}!`;
    console.log(options.shout ? greeting.toUpperCase() : greeting);
  },
});
```

```sh
$ node cli.mjs Ada --shout
HELLO, ADA!
$ node cli.mjs -s Ada
HELLO, ADA!
```

## Generated help

Help is generated from the definition and printed for `-h` or `--help`:

```sh
$ node cli.mjs --help
Usage: greet [command] [options] [name]

Greet someone

Commands:
  completions  Generate a shell completion script

Arguments:
  [name]  Who to greet (default: World)

Options:
  -s, --[no-]shout  Uppercase the greeting
  -h, --help        Show this help
```

The `completions` command is built in. See [Shell completions](./shell-completions.md).

## Errors

An invalid argument produces a report, a suggestion when one is close, and exit status 2:

```sh
$ node cli.mjs --shou
greet: 1 problem

  ✗ unknown option "--shou"
    did you mean --shout?

Run "greet --help" for usage.
```

## Subcommands

A parent command lists subcommands in `commands`. Each subcommand has its own options, positionals,
and action:

```js
import { defineCommand, run } from "yalp-js";

const hello = defineCommand({
  name: "hello",
  description: "Say hello",
  positionals: { name: { required: true } },
  action: ({ positionals }) => console.log(`Hello, ${positionals.name}!`),
});

const bye = defineCommand({
  name: "bye",
  description: "Say goodbye",
  positionals: { name: { required: true } },
  action: ({ positionals }) => console.log(`Goodbye, ${positionals.name}!`),
});

const cli = defineCommand({ name: "greet", commands: [hello, bye] });

await run(cli, { version: "1.0.0" });
```

```sh
$ node cli.mjs hello Ada
Hello, Ada!
$ node cli.mjs --version
1.0.0
```

The `version` option of `run` enables `-V` and `--version` on the root command.

## Further reading

- [Commands](./commands.md)
- [Options and positionals](./options-and-positionals.md)
- [TypeScript](./typescript.md)
