# git-lite

A multi-file CLI that recreates a slice of `git`'s command surface. It isn't a one-to-one clone, only enough of the real surface to be instantly familiar. Each subcommand lives in its own file under `commands/`, and `cli.ts` composes them into the root command.

## What this shows

- **Multi-file composition.** A `Command` is plain data, so each subcommand is a value exported from its own module and collected into an array.
- Subcommands with aliases (`branch`/`br`, `checkout`/`co`)
- Required, optional, and variadic positional arguments (`checkout <branch>`, `branch [name]`, `add <files...>`)
- A required option (`commit -m/--message`)
- A plain boolean (`--amend`) and a negatable boolean (`--verify`, which
  defaults to `true` — pass `--no-verify` to flip it, a real git flag)
- A repeatable option (`commit --trailer`, appended once per occurrence)
- `choices` and `default` (`branch --sort=refname|committerdate`, real git
  for-each-ref keys)
- `--` passthrough (`checkout <branch> -- <paths>`). In yalp, everything after
  `--` is handed to the action unparsed, as `rest` — it is not a general
  end-of-options marker the way it is in real git. Only `checkout` reads
  `rest` here; `--` in front of any other subcommand's arguments (for
  example `add -- a.ts`) does not feed those arguments to `add`.
- A root-only `-V`/`--version` flag
- Running the bare command with no subcommand: yalp's built-in help falls
  back automatically and exits with status 2

## Run it

```sh
node cli.ts commit -m "fix: thing" --no-verify --trailer "Reviewed-by: x"
```

Other commands to try: `add a.ts b.ts`, `branch --sort=committerdate`,
`checkout main -- src/app.ts` (the `--` here is the feature being
demonstrated, not a run-command artifact), `--version`, and the bare command with no arguments. Add `--help` after any subcommand to see its usage.
