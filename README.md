# yalp

[![npm version](https://img.shields.io/npm/v/yalp-js.svg?style=flat)](https://www.npmjs.com/package/yalp-js)
[![npm downloads](https://img.shields.io/npm/dm/yalp-js.svg?style=flat)](https://www.npmjs.com/package/yalp-js)
[![JSR](https://jsr.io/badges/@typical/yalp)](https://jsr.io/@typical/yalp)
[![CI](https://github.com/typicalninja/yalp/actions/workflows/ci.yml/badge.svg)](https://github.com/typicalninja/yalp/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/yalp-js.svg?style=flat)](./LICENSE)

Simple, opinionated framework for building command-line apps.

## Features

- **Full type inference.** Declare an option's type and get it back typed in your action, no generics needed.
- **Zero runtime dependencies.** Small, auditable, nothing to pull in transitively.
- **Argument syntax people already know.** Long/short flags, `-abc` clustering, `--no-name` negation, and `--` passthrough, the same conventions git and npm use.
- **Batteries included.** Help text, version output, and helpful "did you mean" suggestions for typos, all included by default. Need custom formatting instead? Parse the arguments yourself and handle the result directly.
- **Runs anywhere modern.** ESM only, Node.js 22+, Deno, and Bun.

## Install

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

## Usage

A single command:

```ts
import { defineCommand, run } from "yalp-js";

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
import { defineCommand, run } from "yalp-js";

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

More extensive examples live in [`examples/`](./examples), including a multi-file CLI and manual
`parse()` usage instead of `run()`.

## Contributing

Contributions are welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for how to get set up, and please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

MIT © [typicalninja](https://github.com/typicalninja). See [LICENSE](./LICENSE) for the full text.

---

**Star it on [GitHub](https://github.com/typicalninja/yalp) ★** | GitHub [@typicalninja](https://github.com/typicalninja)
