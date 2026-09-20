import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { type Command, defineCommand } from "../src/command.js";
import bash from "../src/completions/bash.js";
import fish from "../src/completions/fish.js";
import zsh from "../src/completions/zsh.js";

const noop = () => undefined;

const test = defineCommand({ name: "test", options: { grep: {} }, action: noop });
const dev = defineCommand({
  name: "dev",
  alias: ["d"],
  description: "Dev tools",
  commands: [test],
  action: noop,
});
const build = defineCommand({
  name: "build",
  alias: ["b"],
  description: "Build it",
  options: {
    out: { short: "o", description: "Output dir [dist]" },
    minify: { type: "boolean" },
    target: { choices: ["es2022", "node"] },
    jobs: { type: "number" },
    tag: { short: "t", multiple: true },
  },
  positionals: { dir: { required: true }, name: {}, more: { multiple: true } },
  action: noop,
});
const root = defineCommand({
  name: "my-app",
  options: { env: {}, verbose: { type: "boolean", short: "v", description: "Chatty" } },
  commands: [build, dev],
  action: noop,
});

/** A group command that also takes a positional, like any app run with built-in completions. */
const mixed = defineCommand({
  name: "greet",
  positionals: { file: {} },
  commands: [
    defineCommand({ name: "sub", description: "Summary line\nMore detail", action: noop }),
  ],
  action: noop,
});

/** Values that would break out of, or be expanded inside, a naively quoted script. */
const hostile = `it's "q" $(touch /tmp/yalp-pwned) \`id\` [x] \\ ; & | > $HOME`;
const hostileRoot = defineCommand({
  name: "hostile-app",
  description: hostile,
  commands: [
    defineCommand({
      name: "sub",
      description: hostile,
      options: {
        opt: { description: hostile, choices: ["a'b", 'c"d', "$(id)", "x y", "a;b", "a:b", "(p)"] },
        flag: { type: "boolean", short: "f", description: "two\nlines" },
      },
      positionals: { pos: { description: hostile, choices: ["q'r", "s t"] } },
      action: noop,
    }),
  ],
  action: noop,
});

const hasShell = (name: string) => spawnSync(name, ["-c", "true"]).status === 0;

/** Runs the shell's parse-only mode over `script`; true when it has no syntax errors. */
const parses = (shell: string, script: string) =>
  spawnSync(shell, ["-n"], { input: script }).status === 0;

describe("bash completions", () => {
  it("registers a hyphen-safe function for the binary and activates with eval", () => {
    const script = bash.generate(root);

    expect(script).toContain("complete -o default -F _my_app my-app");
    // eval, unlike process substitution, also works on the bash 3.2 macOS ships
    expect(bash.completionActivateMessage("my-app")).toBe('eval "$(my-app completions bash)"');
  });

  describe.skipIf(!hasShell("bash"))("in a real bash", () => {
    /** Completes `words` for `cmd` in a real bash whose working directory is `cwd`. */
    const completeIn = (cmd: Command, cwd: string | undefined, ...words: string[]) => {
      const fn = `_${cmd.name.replaceAll("-", "_")}`;
      const harness = `${bash.generate(cmd)}\nCOMP_WORDS=("$@"); COMP_CWORD=$(($# - 1)); ${fn}; printf '%s\\n' "\${COMPREPLY[@]}"`;
      const { stdout } = spawnSync("bash", ["-c", harness, "bash", ...words], {
        cwd,
        encoding: "utf8",
      });
      return stdout.split("\n").filter(Boolean);
    };
    const complete = (...words: string[]) => completeIn(root, undefined, ...words);

    const inTempDir = (body: (dir: string) => void) => {
      const dir = mkdtempSync(join(tmpdir(), "yalp-"));
      try {
        body(dir);
      } finally {
        rmSync(dir, { recursive: true });
      }
    };

    it("completes subcommands, options, aliases, and choices", () => {
      expect(complete("my-app", "")).toEqual(["build", "dev"]);
      expect(complete("my-app", "--")).toEqual(["--env", "--verbose"]);
      expect(complete("my-app", "d", "")).toEqual(["test"]);
      expect(complete("my-app", "b", "--")).toEqual([
        "--out",
        "--minify",
        "--target",
        "--jobs",
        "--tag",
      ]);
      expect(complete("my-app", "build", "--target", "n")).toEqual(["node"]);
    });

    it("stops offering subcommands once a non-subcommand word precedes the cursor", () => {
      expect(complete("my-app", "--env", "prod", "")).toEqual([]);
      expect(complete("my-app", "--verbose", "")).toEqual([]);
      expect(complete("my-app", "--env", "prod", "--")).toEqual(["--env", "--verbose"]);
    });

    it("offers nothing after a value option without choices so bash falls back to files", () => {
      expect(complete("my-app", "build", "--out", "")).toEqual([]);
    });

    it("offers files next to subcommands only for a group that also takes positionals", () => {
      inTempDir((dir) => {
        writeFileSync(join(dir, "apple.txt"), "");

        expect(completeIn(mixed, dir, "greet", "")).toEqual(["sub", "apple.txt"]);
        expect(completeIn(mixed, dir, "greet", "a")).toEqual(["apple.txt"]);
        expect(completeIn(root, dir, "my-app", "")).toEqual(["build", "dev"]);
      });
    });

    it("matches choices literally instead of expanding or word-splitting them", () => {
      inTempDir((dir) => {
        const marker = join(dir, "pwned");
        const choices = [`$(touch ${marker})`, "x y", "a{b,c}", "~", "a'b"];
        const risky = defineCommand({
          name: "risky",
          options: { mode: { choices } },
          action: noop,
        });

        expect(completeIn(risky, dir, "risky", "--mode", "")).toEqual(choices);
        expect(completeIn(risky, dir, "risky", "--mode", "x")).toEqual(["x y"]);
        expect(existsSync(marker)).toBe(false);
      });
    });

    it("does not run shell code embedded in descriptions or command names", () => {
      const { status } = spawnSync("bash", ["-c", `${bash.generate(hostileRoot)}\ntrue`]);
      expect(status).toBe(0);
    });
  });
});

describe("fish completions", () => {
  const script = fish.generate(root);
  const lines = script.split("\n");
  const generate = (cmd: Command) => fish.generate(cmd);

  it("erases earlier registrations so re-sourcing is idempotent", () => {
    expect(lines).toContain("complete -c my-app -e");
  });

  it("marks value options as taking an argument but not boolean flags", () => {
    expect(script).toContain("-l jobs -r");
    expect(lines.find((l) => l.includes("-l verbose"))).toBe(
      `complete -c my-app -n 'not __fish_seen_subcommand_from build b dev d' -s v -l verbose -d 'Chatty'`,
    );
  });

  it("completes only the choices for a choice option, escaping spaces", () => {
    const spacey = generate(
      defineCommand({ name: "s", options: { o: { choices: ["a", "b c"] } }, action: noop }),
    );
    expect(spacey).toContain(String.raw`-l o -x -a 'a b\\ c'`);
  });

  it("quotes descriptions", () => {
    const quoted = generate(
      defineCommand({ name: "q", options: { x: { description: "it's" } }, action: noop }),
    );
    expect(quoted).toContain(String.raw`-d 'it\'s'`);
  });

  it("adds no condition for a root without subcommands", () => {
    const solo = generate(defineCommand({ name: "solo", options: { x: {} }, action: noop }));
    expect(solo).toContain("complete -c solo -l x -r");
    expect(solo).not.toContain("-n");
  });

  it("keeps file completion for a group that also takes positionals and describes subcommands by their first line", () => {
    const grouped = generate(mixed);
    expect(grouped).toContain(
      "complete -c greet -n __fish_use_subcommand -a 'sub' -d 'Summary line'",
    );
    expect(grouped).not.toContain("More detail");
  });

  it("activates by piping into source", () => {
    expect(fish.completionActivateMessage("my-app")).toBe("my-app completions fish | source");
  });

  describe.skipIf(!hasShell("fish"))("in a real fish", () => {
    /** Candidate names fish offers for `line`, after sourcing the generated script. */
    const complete = (line: string) => {
      const { stdout } = spawnSync("fish", ["--no-config", "-c", `source; complete -C '${line}'`], {
        input: script,
        encoding: "utf8",
      });
      return stdout
        .split("\n")
        .filter(Boolean)
        .map((l) => l.split("\t")[0]);
    };

    it("offers subcommands only before any non-dash word is typed", () => {
      expect(complete("my-app ")).toEqual(expect.arrayContaining(["build", "dev"]));
      expect(complete("my-app --env prod ")).not.toContain("build");
      expect(complete("my-app --env prod ")).not.toContain("dev");
    });

    it("keeps offering root options after an option and its value", () => {
      expect(complete("my-app --env prod --")).toEqual(
        expect.arrayContaining(["--env", "--verbose"]),
      );
    });

    it("follows aliases into nested subcommands and scopes options to them", () => {
      expect(complete("my-app d ")).toEqual(expect.arrayContaining(["test"]));
      const nested = complete("my-app dev test --");
      expect(nested).toContain("--grep");
      expect(nested).not.toContain("--out");
    });

    it("parses with hostile values", () => {
      expect(parses("fish", fish.generate(hostileRoot))).toBe(true);
    });
  });
});

describe("zsh completions", () => {
  const script = zsh.generate(root);

  it("is an autoloadable compdef file that registers when sourced and runs when autoloaded", () => {
    expect(script.startsWith("#compdef my-app\n")).toBe(true);
    // function names keep hyphens to match the fpath file name
    expect(script).toContain("_my-app_build() {");
    expect(script).toContain("_my-app_dev_test() {");
    expect(script).toContain('if [ "$funcstack[1]" = "_my-app" ]; then\n  _my-app "$@"');
    expect(script).toContain("compdef _my-app my-app");
  });

  it("specifies options by exclusion, repeatability, and value action", () => {
    expect(script).toContain(`'(--verbose -v)'{--verbose,-v}'[Chatty]'`);
    expect(script).toContain(`'(--out -o)'{--out,-o}'[Output dir [dist\\]]:out:_files'`);
    expect(script).toContain(`'*'{--tag,-t}':tag:_files'`);
    expect(script).toContain(`--target':target:(es2022 node)'`);
    expect(script).toContain(`--jobs':jobs: '`);
    expect(script).toContain("--minify \\\n");
  });

  it("completes required, optional, and variadic positionals", () => {
    expect(script).toContain(`':dir:_files'`);
    expect(script).toContain(`'::name:_files'`);
    expect(script).toContain(`'*:more:_files'`);
  });

  it("lists subcommands with descriptions, dispatches by name or alias, and only directly after the command", () => {
    expect(script).toContain(`local -a cmds=('build:Build it' 'dev:Dev tools')`);
    expect(script).toContain("build|b) _my-app_build ;;");
    expect(script).toContain("dev|d) _my-app_dev ;;");
    expect(script).toContain("(( CURRENT == 2 )) && _describe -t commands command cmds ;;");
  });

  it("escapes spaces inside a choice list", () => {
    const spacey = zsh.generate(
      defineCommand({ name: "s", options: { o: { choices: ["a", "b c"] } }, action: noop }),
    );
    expect(spacey).toContain(String.raw`--o':o:(a b\ c)'`);
  });

  it("offers the first positional's candidates next to subcommands for a group", () => {
    const files = zsh.generate(mixed);
    expect(files).toContain(
      "(( CURRENT == 2 )) && { _describe -t commands command cmds; _files; } ;;",
    );
    expect(files).toContain("*) _files ;;");
    expect(files).toContain("'sub:Summary line'");
    expect(script).not.toContain("*) _files ;;");

    const flagged = zsh.generate(
      defineCommand({
        name: "z",
        positionals: { enabled: { type: "boolean" } },
        commands: [defineCommand({ name: "sub", action: noop })],
        action: noop,
      }),
    );
    expect(flagged).toContain("_describe -t commands command cmds; compadd true false; } ;;");
    expect(flagged).toContain("*) compadd true false ;;");
  });

  it("completes true and false for a boolean positional", () => {
    const flagged = zsh.generate(
      defineCommand({ name: "z", positionals: { enabled: { type: "boolean" } }, action: noop }),
    );
    expect(flagged).toContain(`'::enabled:(true false)'`);
  });

  it("activates by sourcing", () => {
    expect(zsh.completionActivateMessage("my-app")).toBe("source <(my-app completions zsh)");
  });

  it.skipIf(!hasShell("zsh"))("parses in a real zsh with hostile values", () => {
    expect(parses("zsh", zsh.generate(hostileRoot))).toBe(true);
  });
});
