# yalp examples

- [`hello-world/`](./hello-world): the basics
- [`git-lite/`](./git-lite): multi-file, recreates `git`
- [`parse-manual/`](./parse-manual): manual `parse()`, for advanced use

## Setup

```sh
pnpm install && pnpm build
```

## Run

Run this command in the relevant example directory. (ex: git-lite)

```sh
node cli.ts [args]                             # Node 24+
node --experimental-strip-types cli.ts [args]  # Node 22-23
bun cli.ts [args]                               # Bun
```
