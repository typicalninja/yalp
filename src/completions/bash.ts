import type { Command } from "../command.js";
import { posixQuote, type ShellScriptGenerator } from "./shared.js";

const generator: ShellScriptGenerator = {
  name: "bash",
  // eval rather than `source <(...)`, which is broken on the bash 3.2 that macOS ships.
  completionActivateMessage: (bin) => `eval "$(${bin} completions bash)"`,
  generate: (root) => {
    const bin = root.name;
    const fn = `_${bin.replaceAll("-", "_")}`;
    // Case arms for: walking to the typed command, completing option values, listing candidates.
    const walk: string[] = [];
    const values: string[] = [];
    const nodes: string[] = [];

    // `key` is the command path joined by "/", empty for the root.
    const visitNode = (cmd: Command, key: string) => {
      const flags: string[] = [];
      for (const o of Object.values(cmd.options)) {
        const names = [`--${o.name}`, ...(o.short ? [`-${o.short}`] : [])];
        flags.push(...names);
        if (o.type === "boolean") continue;

        const pattern = names.map((n) => `"${key}:${n}"`).join("|");
        // Choices are quoted one by one and matched with a plain prefix test: `compgen -W` would
        // expand `$(...)`, `~` and `{a,b}` inside them.
        values.push(
          o.choices?.length
            ? `${pattern}) for w in ${o.choices.map((c) => posixQuote(String(c))).join(" ")}; do [[ $w == "$cur"* ]] && COMPREPLY+=("$w"); done; return;;`
            : `${pattern}) return;;`,
        );
      }

      const subs = cmd.commands.map((c) => c.name);
      // A group that also takes positionals offers files next to its subcommands.
      const files = subs.length && cmd.positionals.length ? " files=1" : "";
      nodes.push(
        `"${key}") opts=${posixQuote(flags.join(" "))} subs=${posixQuote(subs.join(" "))}${files};;`,
      );

      for (const sub of cmd.commands) {
        const child = key ? `${key}/${sub.name}` : sub.name;
        const pattern = [sub.name, ...sub.alias].map((n) => `"${key}:${n}"`).join("|");
        walk.push(`${pattern}) cmd=${child};;`);
        visitNode(sub, child);
      }
    };

    visitNode(root, "");

    const arms = (list: string[], indent = "    ") => list.map((l) => indent + l);
    return [
      `# bash completion for ${bin}`,
      `${fn}() {`,
      `  local cur=\${COMP_WORDS[COMP_CWORD]} prev=\${COMP_WORDS[COMP_CWORD-1]} cmd= w opts= subs= files= stop=`,
      // Only leading words name subcommands; the first other word ends the walk.
      `  for w in "\${COMP_WORDS[@]:1:COMP_CWORD-1}"; do`,
      `    case "$cmd:$w" in`,
      ...arms(walk, "      "),
      `      *) stop=1; break;;`,
      `    esac`,
      `  done`,
      // An option that takes a value completes only its choices, or files via `-o default` below.
      `  case "$cmd:$prev" in`,
      ...arms(values),
      `  esac`,
      `  case "$cmd" in`,
      ...arms(nodes),
      `  esac`,
      `  if [[ $cur == -* ]]; then`,
      `    COMPREPLY=($(compgen -W "$opts" -- "$cur"))`,
      `  elif [[ -z $stop ]]; then`,
      `    COMPREPLY=($(compgen -W "$subs" -- "$cur"))`,
      `    [[ -n $files ]] && COMPREPLY+=($(compgen -f -- "$cur"))`,
      `  fi`,
      `}`,
      `complete -o default -F ${fn} ${bin}`,
    ].join("\n");
  },
};

export default generator;
