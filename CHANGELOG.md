# Changelog

## [1.1.0]

### Added

- Shell completions for bash, fish, and zsh. `run()` adds a built-in `completions` command that prints a completion script. Subcommands, options with their short forms, and `choices` complete. The command is described in [Shell completions](./docs/shell-completions.md). ([#4])
- `RunOptions.completions`. Set it to `false` to leave the built-in `completions` command out, for example to define a `completions` command of the application's own. ([#4])
- `examples` on commands, with the `Example` type. Examples are listed under `Examples:` in the command's help. ([#3])
- Help text wraps long option and positional descriptions to the terminal width. ([#2])
- Boolean positionals. A positional with `type: "boolean"` accepts the words `true` and `false`. Any other word is reported as `ERR_INVALID_BOOLEAN`. ([#7])
- Validation of parameter declarations. `defineCommand` throws a `ConfigError` with the new code `ERR_INVALID_PARAM` when the fields of a parameter contradict each other: ([#9])
  - a `default` outside `choices`, or of the wrong type or shape
  - empty `choices`, `choices` of the wrong type, or `choices` on a boolean
  - a `short` on a positional
- Documentation in [`docs/`](./docs): quick start, commands, options and positionals, help and errors, shell completions, TypeScript, and advanced usage. The public API has doc comments with parameters, return values, thrown errors, and examples. ([#5], [#10])

### Changed

- `run()` adds the `completions` command to the root command by default: ([#4])
  - The root help lists `completions`.
  - A root command or alias named `completions` is rejected with `ERR_RESERVED_NAME`. Pass `completions: false` to define one.
  - A root command with no subcommands and no action now behaves as a group. It prints its usage to standard error and exits with status 2, where it previously printed the help to standard output and exited with status 0. Pass `completions: false` to keep the previous behavior.
- A parent's `Commands:` table shows only the first line of a subcommand's description. The subcommand's own help shows the whole description. ([#4])
- `alias`, `examples`, and `commands` accept `readonly` arrays, so `as const` values are valid. `defineCommand` keeps its own copy of these arrays. ([#11])

### Removed

- The types `CommandAction`, `ConfigErrorOptions`, `findOptionByShort`, and `findSubCommand` are no longer exported from the package entry point. They were exported as types only, and they are internal. ([#6])

### Fixed

- Option names that exist on `Object.prototype`, such as `--constructor`, `--toString`, and `--__proto__`, were accepted silently or reported as missing a value. They are now reported as unknown options. A positional with such a name also receives `did you mean` suggestions for an invalid choice. ([#8])
- A boolean positional was typed `boolean` but returned the word as a string. ([#7])

[1.1.0]: https://github.com/typicalninja/yalp/compare/v1.0.1...v1.1.0
[#2]: https://github.com/typicalninja/yalp/pull/2
[#3]: https://github.com/typicalninja/yalp/pull/3
[#4]: https://github.com/typicalninja/yalp/pull/4
[#5]: https://github.com/typicalninja/yalp/pull/5
[#6]: https://github.com/typicalninja/yalp/pull/6
[#7]: https://github.com/typicalninja/yalp/pull/7
[#8]: https://github.com/typicalninja/yalp/pull/8
[#9]: https://github.com/typicalninja/yalp/pull/9
[#10]: https://github.com/typicalninja/yalp/pull/10
[#11]: https://github.com/typicalninja/yalp/pull/11
