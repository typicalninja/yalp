# yalp documentation

API reference: [npmx.dev](https://npmx.dev/package-docs/yalp-js/).

## Guides

- [Quick start](./quick-start.md): a first CLI, built in steps.
- [Commands](./commands.md): commands, subcommands, aliases, actions, and examples.
- [Options and positionals](./options-and-positionals.md): parameter declarations and the accepted argument syntax.
- [Help and errors](./help-and-errors.md): help text, version output, error messages, suggestions, and exit codes.
- [Shell completions](./shell-completions.md): completion scripts for bash, fish, and zsh.
- [TypeScript](./typescript.md): type inference for options and positionals.
- [Advanced usage](./advanced.md): multi-file layouts, testing, and `parse()`.

## Examples

Runnable programs in [`examples/`](../examples):

- [`hello-world`](../examples/hello-world): a command with a positional, two options, and examples.
- [`git-lite`](../examples/git-lite): a multi-file CLI with aliases, choices, repeatable options,
  and negatable flags.
- [`parse-manual`](../examples/parse-manual): handling the result of `parse()` directly.
