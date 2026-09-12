# yalp

[![npm version](https://img.shields.io/npm/v/yalp.svg?style=flat)](https://www.npmjs.com/package/yalp)
[![npm downloads](https://img.shields.io/npm/dm/yalp.svg?style=flat)](https://www.npmjs.com/package/yalp)
[![JSR](https://jsr.io/badges/@typicalninja/yalp)](https://jsr.io/@typicalninja/yalp)
[![CI](https://github.com/typicalninja/yalp/actions/workflows/ci.yml/badge.svg)](https://github.com/typicalninja/yalp/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/yalp.svg?style=flat)](./LICENSE)

Simple opinionated framework for building command-line apps.

Describe your CLI's shape once (options, positionals, subcommands) and yalp handles parsing,
validation, `--help`/`--version`, and helpful "did you mean" errors for you. No boilerplate, no
runtime dependencies, fully typed end to end.

## Features

- **Full type inference.** Declare an option's type and get it back typed in your action, no
  generics needed.
- **Zero runtime dependencies.** Small, auditable, nothing to pull in transitively.
- **Argument syntax people already know.** Long/short flags, `-abc` clustering, `--no-name`
  negation, and `--` passthrough, the same conventions git and npm use.
- **Batteries included, but optional.** `run()` gives you help text, version output, and formatted
  errors for free. Prefer to own your output? Call `parse()` directly instead.
- **Runs anywhere modern.** ESM only, Node.js 22+, Deno, and Bun.

## Install

```sh
npm install yalp
pnpm add yalp
bun add yalp
```

## Usage

A single command:

```ts
import { defineCommand, run } from "yalp";

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

await run(cli);
```

```sh
$ node cli.js Ada --shout
HELLO, ADA!
```

Subcommands:

```ts
import { defineCommand, run } from "yalp";

const add = defineCommand({
  name: "add",
  description: "Stage files",
  positionals: {
    files: { description: "Paths to stage", multiple: true, required: true },
  },
  action: ({ positionals }) => {
    console.log(`Staged: ${positionals.files.join(", ")}`);
  },
});

const cli = defineCommand({ name: "git-lite", commands: [add] });

await run(cli, { version: "1.0.0" });
```

```sh
$ node cli.js add a.ts b.ts
Staged: a.ts, b.ts
```

More, larger examples live in [`examples/`](./examples), including a multi-file CLI and calling
`parse()` directly instead of `run()`.

## Contributing

Contributions are welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for how to get set up, and please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

MIT © [typicalninja](https://github.com/typicalninja). See [LICENSE](./LICENSE) for the full text.

---

**Star it on [GitHub](https://github.com/typicalninja/yalp) ★** | GitHub [@typicalninja](https://github.com/typicalninja)
