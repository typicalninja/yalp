# hello-world

The smallest useful yalp CLI: one command, no subcommands.

## What this shows

- `defineCommand` and `run`, end to end
- An optional positional argument with a `default` value
- A boolean option with a `short` flag
- A number option with a `default` value

## Run it

```sh
node cli.ts Ada --shout
```

This prints `HELLO, ADA!`. Run `node cli.ts --help` to see the generated
usage, or see the [examples README](../README.md) for other ways to run it
(Node 22/23, Bun).
