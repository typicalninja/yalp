import type { Command } from "../command.js";
import type { Param } from "../parameter.js";
import { posixQuote, type ShellScriptGenerator } from "./shared.js";

// Escapes what _arguments treats as a separator inside a choice list.
const item = (s: string): string => s.replace(/[\s()\\:]/g, "\\$&");

/** The `_arguments` action: choices, `true`/`false` for booleans, files for strings, else nothing. */
const action = (p: Param): string => {
  if (p.choices?.length) return `(${p.choices.map((c) => item(String(c))).join(" ")})`;
  if (p.type === "boolean") return "(true false)";
  return p.type === "string" ? "_files" : " ";
};

const optionSpec = (o: Param): string => {
  const names = [`--${o.name}`, ...(o.short ? [`-${o.short}`] : [])];
  // Repeatable options are always offered; the rest exclude their own aliases once used.
  const lead = o.multiple ? "*" : names.length > 1 ? `(${names.join(" ")})` : "";
  const description = o.description ? `[${o.description.replace(/[\\\]]/g, "\\$&")}]` : "";
  const value = o.type === "boolean" ? "" : `:${o.name}:${action(o)}`;
  // Aliases use brace expansion, so they must sit outside the quotes.
  const flags = names.length > 1 ? `{${names.join(",")}}` : names[0];
  const tail = description + value;
  return `${lead && posixQuote(lead)}${flags}${tail && posixQuote(tail)}`;
};

const positionalSpec = (p: Param): string =>
  posixQuote(`${p.multiple ? "*" : p.required ? "" : ":"}:${p.name}:${action(p)}`);

const generator: ShellScriptGenerator = {
  name: "zsh",
  completionActivateMessage: (bin) => `source <(${bin} completions zsh)`,
  generate: (root) => {
    const bin = root.name;
    // Hyphens stay: the root function must match the `_<bin>` file name zsh autoloads from fpath.
    const fnName = (path: string[]) => `_${[bin, ...path].join("_")}`;
    const fns: string[] = [];

    const visitNode = (cmd: Command, path: string[]) => {
      const specs = Object.values(cmd.options).map(optionSpec);
      const lines: string[] = [];

      if (cmd.commands.length) {
        specs.push(posixQuote("1: :->cmds"), posixQuote("*:: :->args"));
        // Only the summary line of a multi-line description fits a completion menu.
        const cmds = cmd.commands.map((c) => {
          const summary = c.description?.split("\n", 1)[0];
          return posixQuote(summary ? `${c.name}:${summary}` : c.name);
        });
        // A group that also takes positionals offers the first one's candidates next to its
        // subcommands: files, or `true` and `false`.
        const [first] = cmd.positionals;
        const offered = first && action(first);
        const extra =
          offered === "_files" ? "_files" : offered === "(true false)" ? "compadd true false" : "";
        const arms = cmd.commands.map((c) => {
          visitNode(c, [...path, c.name]);
          return `        ${[c.name, ...c.alias].join("|")}) ${fnName([...path, c.name])} ;;`;
        });
        lines.push(
          `  local curcontext="$curcontext" state line`,
          `  typeset -A opt_args`,
          `  ${["_arguments -C", ...specs].join(" \\\n    ")}`,
          `  case $state in`,
          `    cmds)`,
          `      local -a cmds=(${cmds.join(" ")})`,
          // Mirrors the parser: only the word right after the command can be a subcommand.
          extra
            ? `      (( CURRENT == 2 )) && { _describe -t commands command cmds; ${extra}; } ;;`
            : `      (( CURRENT == 2 )) && _describe -t commands command cmds ;;`,
          `    args)`,
          `      case $line[1] in`,
          ...arms,
          ...(extra ? [`        *) ${extra} ;;`] : []),
          `      esac ;;`,
          `  esac`,
        );
      } else {
        specs.push(...cmd.positionals.map(positionalSpec));
        lines.push(`  ${["_arguments", ...specs].join(" \\\n    ")}`);
      }

      fns.push([`${fnName(path)}() {`, ...lines, `}`].join("\n"));
    };

    visitNode(root, []);

    const fn = fnName([]);
    return [
      `#compdef ${bin}`,
      ...fns,
      // Sourced: register the function. Autoloaded from fpath: run it.
      `if [ "$funcstack[1]" = "${fn}" ]; then\n  ${fn} "$@"\nelse\n  compdef ${fn} ${bin}\nfi`,
    ].join("\n\n");
  },
};

export default generator;
