# Yalp guidelines for editing and development

## General Guidelines

- These are guidelines, not rules. If the output is better not following them inform the user, get permission and do it.
- This is a public project, the code quality should be maintained to a public library standard.

## Code Style

- Use the `pnpm run fmt` to format the code, or `pnpm run fmt:check` to check the issues in the code formatting without applying any fixes.
- Use the `pnpm run lint` to lint the code, or `pnpm run lint:fix` to fix the issues automatically.
- Ensure the code passes through all of the above before any commits.
- Prefer one conventional way a feature works, Do not add multiple ways to do the same thing, unless there is a specific user need.

## Commit Guidelines

- Use conventional commits for commit messages.
- Commits should be atomic and focused on a single change.

## Product Overview

- yalp is a opinioted, ergonomic, reliable CLI parser & toolkit for Javascript / Typescript.
- It is similar to OSS packages like, yargs and commander.
- It is ESM first, and targets ES2022.
- Keep it runtime agnostic as possible, target NodeJS 22+, bun support is also preferred. However, do not let it complicate the API implementation.
- Optimize the common case for CLI authors. If they need configurability they would use other libraries, we are here to give one way to do it. that is the best way.

## Typescript Guidelines

- Keep typescript strict and produce zero `any` types.
- Prefer `unknown` with explicit narrowing, discriminated uninons, exhaustive handling, readonly inputs, and type-preserving fluent APIs.
- Do not weaken compiler or lint settings to make a change pass.
- Avoid unsafe casts. When a cast is necessary at an internal type-erasure boundary, keep it narrow and document why the runtime invariant is safe.
- Use `.js` extensions for internal ESM imports from TypeScript source.

## Security and Performance

- Treat `argv` and every other external string as untrusted input.
- Do not use evaluation, shell interpretation, locale-dependent parsing, or implicit coercion for argument values.
- Keep parsing linear in the number and total length of input tokens. Avoid repeated command-tree scans and unnecessary array copies.
- Keep zero runtime dependencies by default. Add one only when it provides substantial reviewed value that cannot remain small and maintainable in this package.

# Working Practices

- Preserve unrelated user changes and untracked files. Do not perform drive-by refactors.
- State assumptions when requirements are incomplete. Ask only when a decision materially changes the public contract.
- Do not edit generated `dist` files directly. Generate them with the build command when verification requires them.
- Inspect the relevant implementation, repository status, and existing changes before editing.
