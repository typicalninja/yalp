# Shell completions

`run` adds a `completions` command to the root command. The command prints a completion script for bash, fish, or zsh to standard output. yalp does not modify shell configuration files.

```sh
$ my-app completions --help
Usage: my-app completions [command]

Generate a shell completion script

To enable completions, run one of these or add it to your shell's startup file:

  bash  eval "$(my-app completions bash)"
  fish  my-app completions fish | source
  zsh   source <(my-app completions zsh)

Commands:
  bash  Generate the bash completion script
  fish  Generate the fish completion script
  zsh   Generate the zsh completion script

Options:
  -h, --help  Show this help
```

## Enabling completions

`my-app` stands for the root command's name.

### bash

Current session:

```sh
source <(my-app completions bash)
```

Every session: the same line in `~/.bashrc`.

In bash 3.2, `source <(...)` registers no completions and prints no error. `eval` works in that version:

```sh
eval "$(my-app completions bash)"
```

### fish

Current session:

```sh
my-app completions fish | source
```

Every session: the script saved where fish autoloads completions.

```sh
my-app completions fish > ~/.config/fish/completions/my-app.fish
```

### zsh

zsh requires its completion system to be loaded first. When `~/.zshrc` does not already call `compinit`:

```sh
autoload -Uz compinit && compinit
source <(my-app completions zsh)
```

Alternatively, the script can be saved as a file named `_my-app` in a directory on `fpath`, which must be set before `compinit` runs:

```sh
mkdir -p ~/.zfunc
my-app completions zsh > ~/.zfunc/_my-app
# in ~/.zshrc, before compinit:
fpath=(~/.zfunc $fpath)
```

## Completed items

| Position               | Completions                                                |
| ---------------------- | ---------------------------------------------------------- |
| A command's first word | Its subcommands. fish and zsh show descriptions.           |
| A word that starts `-` | The command's options, including short forms such as `-s`. |
| After an option        | The option's `choices`. Without choices, files.            |
| A positional           | Files.                                                     |

Without `choices`, zsh offers files only for parameters of type `"string"`. bash and fish offer files for every type.

Completions follow the parser's rules: subcommand names complete only at the start of the arguments, and each command completes only its own options. See
[Command resolution](./commands.md#command-resolution).

Scripts register under the root command's `name`. A different executable name is not covered.

## Disabling completions

```ts
await run(cli, { completions: false });
```

`completions: false` omits the `completions` command. With the built-in command enabled, a root command or alias named `completions` throws a `ConfigError` with the code `ERR_RESERVED_NAME`, because a second command with that name cannot be added.

## Limitations

- `--no-<flag>`, `-h`, `--help`, `-V`, and `--version` are not completed.
- In bash, `--option=value` does not complete. `--option value` does.
- In fish, a nested subcommand can be offered after a flag that the parser rejects. bash and zsh match the parser.
- bash shows no descriptions, because bash completion has no place for them.
