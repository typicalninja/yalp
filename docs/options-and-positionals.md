# Options and positionals

A command takes two kinds of parameters:

- An option is named and passed with a flag: `--times 3` or `-t 3`.
- A positional is identified by its position: `ada` in `greet ada`.

Both are declared with the same fields.

## Declaration

Options and positionals are objects keyed by name. Every field is optional.

```ts
import { defineCommand } from "yalp-js";

const cmd = defineCommand({
  name: "greet",
  options: {
    times: { type: "number", short: "t", default: 1, description: "Repeat the greeting" },
    shout: { type: "boolean", short: "s" },
  },
  positionals: {
    name: { required: true, description: "Who to greet" },
  },
  action: ({ options, positionals }) => {
    // options.times: number, options.shout: boolean | undefined, positionals.name: string
  },
});
```

| Field         | Applies to | Description                                           |
| ------------- | ---------- | ----------------------------------------------------- |
| `type`        | both       | `"string"` (the default), `"number"`, or `"boolean"`. |
| `short`       | options    | One-letter alias, used as `-t`.                       |
| `description` | both       | Help text.                                            |
| `required`    | both       | Omission is an error unless a `default` is set.       |
| `default`     | both       | Value used when the parameter is omitted.             |
| `multiple`    | both       | Collects every occurrence into an array.              |
| `choices`     | both       | Permitted values. Any other value is an error.        |

### Names

Option and positional names are kebab-case, as command names are. A name such as `dry-run` is not a valid identifier, so the action reads it with brackets: `options["dry-run"]`.

Reserved names:

- An option cannot be named `help` or `version`. `-h` and `-V` cannot be used as a `short`.
- An option name cannot start with `no-`. `--no-name` is the negation of a boolean option `name`.
- A `short` is a single letter and is unique among the options of a command.

### Types

| `type`      | Action receives | Parsing                                                                    |
| ----------- | --------------- | -------------------------------------------------------------------------- |
| `"string"`  | `string`        | The text as given.                                                         |
| `"number"`  | `number`        | JavaScript's `Number()`. `3`, `1e3`, and `0x10` are valid.                 |
| `"boolean"` | `boolean`       | An option: presence of the flag. A positional: the word `true` or `false`. |

An empty or whitespace-only value, and any text that `Number()` converts to `NaN`, is an error:

```
✗ "times" expects a number, got "abc"
```

A boolean positional accepts exactly `true` or `false`, in lowercase. Any other word is an error:

```
✗ "enabled" expects true or false, got "yes"
```

### Required and default

- A parameter that is neither `required` nor given a `default` is `undefined` when omitted.
- A `default` supplies the value when the parameter is omitted. A parameter with a `default` never fails the `required` check.
- An omitted `required` parameter without a `default` is an error: `✗ "message" is required`.

### Choices

`choices` restricts a parameter to a fixed set of values. The check runs after type conversion, so a `number` parameter takes numeric choices.

```ts
options: {
  sort: { choices: ["refname", "committerdate"], default: "refname" },
  level: { type: "number", choices: [1, 2, 3] },
}
```

```
✗ "sort" must be one of: refname, committerdate
```

A close match to the given value is suggested. See [Help and errors](./help-and-errors.md#suggestions).

### Repeated options

With `multiple: true`, the action receives an array. The array is empty when the option is not passed.

```ts
options: {
  tag: { multiple: true, description: "Add a tag (repeatable)" },
}
```

```sh
$ my-app --tag a --tag b     # options.tag is ["a", "b"]
$ my-app                     # options.tag is []
```

Without `multiple`, a repeated option is not an error. The last value wins.

### Booleans and negation

`--name` sets a boolean option to `true`, and `--no-name` sets it to `false`. A boolean option with `default: true` models a behavior that is switched off with the negation.

```ts
options: {
  verify: { type: "boolean", default: true, description: "Run pre-commit hooks" },
}
```

```sh
$ my-app                  # options.verify is true
$ my-app --no-verify      # options.verify is false
```

A boolean flag takes no value. `--verify=false` is an error that names `--no-verify`.

## Positionals

Positionals are filled in declaration order. `defineCommand` throws a `ConfigError` for two orderings:

- A required positional after an optional one.
- Any positional after one with `multiple: true`, which collects all remaining words.

```ts
positionals: {
  source: { required: true },
  target: {},
  files: { multiple: true },
}
```

Help shows a required positional as `<source>`, an optional one as `[target]`, and a variadic one as `[files...]`.

A word beyond the last positional is an error:

```
✗ unexpected argument "extra"
```

## Argument syntax

| Input                 | Meaning                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `--name value`        | Long option with a value.                                                                                             |
| `--name=value`        | Long option with a value, in one word.                                                                                |
| `-n value`, `-nvalue` | Short option with a value.                                                                                            |
| `-abc`                | Cluster of short flags. A short option that takes a value ends the cluster: `-vqn out` sets `-v`, `-q`, and `-n out`. |
| `--name`, `--no-name` | Boolean flag and its negation.                                                                                        |
| `-3`, `-`             | Positional words. A dash followed by a digit, and a lone dash, are not options.                                       |
| `--`                  | Ends parsing. Every later word reaches the action as `rest`, unparsed.                                                |
| `-h`, `--help`        | Help.                                                                                                                 |
| `-V`, `--version`     | Version, on the root command, when `version` is passed to `run`.                                                      |

Details:

- An option that takes a value consumes the next word even when it starts with a dash. In `--name --tag`, the value of `--name` is `--tag`.
- `--` is not a general end-of-options marker. Words after it never fill a positional. They reach the action only as `rest`.
- `-h` and `--help` take precedence over other parsing. Either one, anywhere before `--`, prints the help of the command reached so far before the remaining arguments are checked. `my-app build --bogus --help` prints the help for `build`.
- Option names and short aliases are case-sensitive. `-V` and `-v` are different flags.
