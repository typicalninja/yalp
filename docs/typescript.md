# TypeScript

The type of each option and positional is inferred from its declaration. The action receives typed
values without generics or casts.

```ts
import { defineCommand } from "yalp-js";

defineCommand({
  name: "greet",
  options: {
    times: { type: "number", default: 1 },
    shout: { type: "boolean" },
  },
  positionals: { name: { required: true } },
  action: ({ options, positionals }) => {
    options.times; // number
    options.shout; // boolean | undefined
    positionals.name; // string
  },
});
```

## Inference rules

| Declaration                               | Type in the action        |
| ----------------------------------------- | ------------------------- |
| `{}`                                      | `string \| undefined`     |
| `{ type: "number" }`                      | `number \| undefined`     |
| `{ type: "boolean" }`                     | `boolean \| undefined`    |
| `{ required: true }`                      | `string`                  |
| `{ default: "x" }`                        | `string`                  |
| `{ type: "boolean", default: true }`      | `boolean`                 |
| `{ multiple: true }`                      | `string[]`                |
| `{ type: "boolean", multiple: true }`     | `boolean[]`               |
| `{ choices: ["a", "b"] }`                 | `"a" \| "b" \| undefined` |
| `{ choices: ["a", "b"], required: true }` | `"a" \| "b"`              |
| `{ type: "number", choices: [1, 2] }`     | `1 \| 2 \| undefined`     |

- `type` selects the base type and defaults to `string`.
- `choices` narrows the base type to a union of the listed values. `as const` is not needed.
- `multiple: true` produces an array. An omitted option yields an empty array, never `undefined`.
- `required: true` and `default` each remove `undefined`.

Keys that are not valid identifiers keep their spelling: `options["dry-run"]`.

## Inline actions

Types flow from the `options` and `positionals` of a `defineCommand` call into the `action` of the same call. An action defined elsewhere loses this inference and requires an explicit `ActionArgs` annotation.

## Exported types

| Type                                | Description                                                   |
| ----------------------------------- | ------------------------------------------------------------- |
| `Command`                           | The value returned by `defineCommand`.                        |
| `ActionArgs`                        | The argument of an `action`.                                  |
| `ParamSpec`, `ParamValue`           | A parameter declaration, and the value type it produces.      |
| `Example`                           | An entry of a command's `examples`.                           |
| `RunOptions`                        | The second argument of `run`.                                 |
| `ParseResult`, `Issue`, `IssueCode` | The result of `parse()`. See [Advanced usage](./advanced.md). |
| `ConfigErrorCode`                   | The `code` values of a `ConfigError`.                         |
