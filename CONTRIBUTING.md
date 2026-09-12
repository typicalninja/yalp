# Contributing to yalp

Thanks for taking the time to contribute. This project is small and opinionated on purpose. Please read the note on scope below before starting on a larger change.

## Prerequisites

- Node.js 22 or later
- [pnpm](https://pnpm.io) (the version this repo expects is pinned in `package.json`'s
  `devEngines` field; pnpm will offer to install it for you if you don't have it)

## Getting set up

```sh
git clone https://github.com/typicalninja/yalp.git
cd yalp
pnpm install
```

Useful scripts:

| Command                  | What it does                     |
| ------------------------ | -------------------------------- |
| `pnpm build`             | Build the library with tsdown    |
| `pnpm dev`               | Build in watch mode              |
| `pnpm typecheck`         | Type-check with `tsc --noEmit`   |
| `pnpm lint` / `lint:fix` | Lint with oxlint                 |
| `pnpm fmt` / `fmt:check` | Format with oxfmt                |
| `pnpm test`              | Run the test suite once          |
| `pnpm test:watch`        | Run tests in watch mode          |
| `pnpm test:coverage`     | Run tests with a coverage report |

## Before opening a pull request

Run these and make sure they all pass, the CI will run the same checks on every PR:

```sh
pnpm fmt:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Making changes

- Keep pull requests focused on one change. Unrelated cleanups make review harder.
- Add or update tests for any behavior change.
- Follow [Conventional Commits](https://www.conventionalcommits.org) for commit messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, ...).
- If you're changing or adding to the public API, add a runnable example under [`examples/`](../examples) if one would help. See the existing examples for the house style (every option/positional/command gets a `description`).

## Scope

yalp deliberately does one thing: parse and run CLI commands, well. Feature requests that add a second way to do something yalp can already do, or that pull the library toward a specific framework or runtime, are likely to be declined. If you're not sure whether something fits, open an issue to discuss it before writing code.

## Reporting bugs

Open an issue with the command you ran, what you expected, and what actually happened. A minimal reproduction (a few lines using `defineCommand`) is the fastest way to get it fixed.

## Code of Conduct

This project follows a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you're expected to uphold it.
