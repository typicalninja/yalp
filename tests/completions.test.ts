import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
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
  const script = bash.generate(root);

  it("registers a hyphen-safe function for the binary", () => {
    expect(script).toContain("_my_app() {");
    expect(script).toContain("complete -o default -F _my_app my-app");
  });

  it("follows subcommand names and aliases while walking the command line", () => {
    expect(script).toContain('":build"|":b") cmd=build;;');
    expect(script).toContain('":dev"|":d") cmd=dev;;');
    expect(script).toContain('"dev:test") cmd=dev/test;;');
  });

  it("ends the walk at the first word that is not a subcommand", () => {
    expect(script).toContain("*) stop=1; break;;");
  });

  it("lists each command's options (with short forms) and subcommands", () => {
    expect(script).toContain(`"") opts='--env --verbose -v' subs='build dev';;`);
    expect(script).toContain(
      `"build") opts='--out -o --minify --target --jobs --tag -t' subs='';;`,
    );
    expect(script).toContain(`"dev") opts='' subs='test';;`);
  });

  it("falls back to files for value options and completes choices for choice options", () => {
    expect(script).toContain('":--env") return;;');
    expect(script).toContain('"build:--out"|"build:-o") return;;');
    expect(script).toContain(
      `"build:--target") for w in 'es2022' 'node'; do [[ $w == "$cur"* ]] && COMPREPLY+=("$w"); done; return;;`,
    );
  });

  it("does not treat boolean flags as taking a value", () => {
    expect(script).not.toContain('"build:--minify")');
    expect(script).not.toContain('":--verbose"');
  });

  it("single-quotes choice values", () => {
    const quoted = bash.generate(
      defineCommand({ name: "q", options: { o: { choices: ["a'b"] } }, action: noop }),
    );
    expect(quoted).toContain(`for w in 'a'\\''b';`);
  });

  it("activates with eval, which also works on the bash 3.2 macOS ships", () => {
    expect(bash.completionActivateMessage("my-app")).toBe('eval "$(my-app completions bash)"');
  });

  describe.skipIf(!hasShell("bash"))("in a real bash", () => {
    const complete = (...words: string[]) => {
      const harness = `${script}\nCOMP_WORDS=("$@"); COMP_CWORD=$(($# - 1)); _my_app; printf '%s\\n' "\${COMPREPLY[@]}"`;
      const { stdout } = spawnSync("bash", ["-c", harness, "bash", ...words], { encoding: "utf8" });
      return stdout.split("\n").filter(Boolean);
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

    it("does not run shell code embedded in descriptions or command names", () => {
      const { status } = spawnSync("bash", ["-c", `${bash.generate(hostileRoot)}\ntrue`]);
      expect(status).toBe(0);
    });

    /** Completes `words` for `cmd` in a real bash whose working directory is `cwd`. */
    const completeIn = (cmd: Command, cwd: string, ...words: string[]) => {
      const fn = `_${cmd.name.replaceAll("-", "_")}`;
      const harness = `${bash.generate(cmd)}\nCOMP_WORDS=("$@"); COMP_CWORD=$(($# - 1)); ${fn}; printf '%s\\n' "\${COMPREPLY[@]}"`;
      const { stdout } = spawnSync("bash", ["-c", harness, "bash", ...words], {
        cwd,
        encoding: "utf8",
      });
      return stdout.split("\n").filter(Boolean);
    };

    const inTempDir = (test: (dir: string) => void) => {
      const dir = mkdtempSync(join(tmpdir(), "yalp-"));
      try {
        test(dir);
      } finally {
        rmSync(dir, { recursive: true });
      }
    };

    it("matches choices literally instead of expanding them", () => {
      inTempDir((dir) => {
        const marker = join(dir, "pwned");
        const choices = [`$(touch ${marker})`, "x y", "a{b,c}", "~"];
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
  });
});

describe("fish completions", () => {
  const script = fish.generate(root);
  const lines = script.split("\n");
  const rootWhen = "-n 'not __fish_seen_subcommand_from build b dev d'";

  it("erases earlier registrations so re-sourcing is idempotent", () => {
    expect(lines).toContain("complete -c my-app -e");
  });

  it("scopes root options to before a subcommand and root subcommands to fish's own helper", () => {
    expect(lines).toContain(`complete -c my-app ${rootWhen} -l env -r`);
    expect(lines).toContain(
      "complete -c my-app -n __fish_use_subcommand -f -a 'build' -d 'Build it'",
    );
  });

  it("marks value options as taking an argument but not boolean flags", () => {
    expect(script).toContain("-l jobs -r");
    expect(lines.find((l) => l.includes("-l verbose"))).toBe(
      `complete -c my-app ${rootWhen} -s v -l verbose -d 'Chatty'`,
    );
  });

  it("completes only the choices for a choice option, escaping spaces", () => {
    const spacey = fish.generate(
      defineCommand({ name: "s", options: { o: { choices: ["a", "b c"] } }, action: noop }),
    );
    expect(spacey).toContain(String.raw`-l o -x -a 'a b\\ c'`);
  });

  it("stops offering a parent's options and subcommands once a nested subcommand is typed", () => {
    const seenDev = "__fish_seen_subcommand_from dev d";
    expect(lines).toContain(
      `complete -c my-app -n '${seenDev}; and not __fish_seen_subcommand_from test' -f -a 'test'`,
    );
    expect(lines).toContain(
      `complete -c my-app -n '${seenDev}; and __fish_seen_subcommand_from test' -l grep -r`,
    );
  });

  it("adds no condition for a root without subcommands", () => {
    const solo = fish.generate(defineCommand({ name: "solo", options: { x: {} }, action: noop }));
    expect(solo).toContain("complete -c solo -l x -r");
    expect(solo).not.toContain("-n");
  });

  it("quotes descriptions", () => {
    const quoted = fish.generate(
      defineCommand({ name: "q", options: { x: { description: "it's" } }, action: noop }),
    );
    expect(quoted).toContain(String.raw`-d 'it\'s'`);
  });

  it("activates by piping into source", () => {
    expect(fish.completionActivateMessage("my-app")).toBe("my-app completions fish | source");
  });

  it.skipIf(!hasShell("fish"))("parses in a real fish with hostile values", () => {
    expect(parses("fish", fish.generate(hostileRoot))).toBe(true);
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
  });
});

describe("zsh completions", () => {
  const script = zsh.generate(root);

  it("is an autoloadable compdef file for the binary", () => {
    expect(script.startsWith("#compdef my-app\n")).toBe(true);
  });

  it("names functions after the command path, keeping hyphens to match the fpath file name", () => {
    expect(script).toContain("_my-app() {");
    expect(script).toContain("_my-app_build() {");
    expect(script).toContain("_my-app_dev_test() {");
  });

  it("registers with compdef when sourced and runs directly when autoloaded", () => {
    expect(script).toContain('if [ "$funcstack[1]" = "_my-app" ]; then\n  _my-app "$@"');
    expect(script).toContain("compdef _my-app my-app");
  });

  it("makes short and long forms exclude each other", () => {
    expect(script).toContain(`'(--verbose -v)'{--verbose,-v}'[Chatty]'`);
    expect(script).toContain(`'(--out -o)'{--out,-o}'[Output dir [dist\\]]:out:_files'`);
  });

  it("lets repeatable options be used again", () => {
    expect(script).toContain(`'*'{--tag,-t}':tag:_files'`);
  });

  it("completes files for strings, choices for choice options, and nothing for numbers", () => {
    expect(script).toContain(`--env':env:_files'`);
    expect(script).toContain(`--target':target:(es2022 node)'`);
    expect(script).toContain(`--jobs':jobs: '`);
  });

  it("escapes spaces inside a choice list", () => {
    const spacey = zsh.generate(
      defineCommand({ name: "s", options: { o: { choices: ["a", "b c"] } }, action: noop }),
    );
    expect(spacey).toContain(String.raw`--o':o:(a b\ c)'`);
  });

  it("emits a bare flag with no trailing empty quotes", () => {
    expect(script).toContain("--minify \\\n");
  });

  it("completes required, optional, and variadic positionals", () => {
    expect(script).toContain(`':dir:_files'`);
    expect(script).toContain(`'::name:_files'`);
    expect(script).toContain(`'*:more:_files'`);
  });

  it("lists subcommands with descriptions and dispatches by name or alias", () => {
    expect(script).toContain(`local -a cmds=('build:Build it' 'dev:Dev tools')`);
    expect(script).toContain("_describe -t commands command cmds");
    expect(script).toContain("build|b) _my-app_build ;;");
    expect(script).toContain("dev|d) _my-app_dev ;;");
  });

  it("offers subcommands only directly after the command, as the parser does", () => {
    expect(script).toContain("(( CURRENT == 2 )) && _describe -t commands command cmds ;;");
  });

  it("activates by sourcing", () => {
    expect(zsh.completionActivateMessage("my-app")).toBe("source <(my-app completions zsh)");
  });

  it.skipIf(!hasShell("zsh"))("parses in a real zsh with hostile values", () => {
    expect(parses("zsh", zsh.generate(hostileRoot))).toBe(true);
  });
});
