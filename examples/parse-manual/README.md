# parse-manual

Most CLIs should use `run()`, shown in the other two examples. This example is for a less common case: calling `parse()` directly and handling the result yourself. Reach for it only if you need custom output formatting, custom logging, or want to embed yalp's parsing inside a larger framework or router.

## What this shows

- `parse(cmd, argv)` returning a discriminated `ParseOk | ParseFail`
- Handling a failed parse yourself: reading `result.issues` and setting
  `process.exitCode`
- A required positional argument

## Run it

```sh
node cli.ts Ada --loud
```

Run `node cli.ts` with no name to see a hand-printed error instead of yalp's built-in formatting.
