import type { Command } from "../command.js";
import { ShellScriptGenerator } from "./shared.js";

const seen = (from: string[]) => `__fish_seen_subcommand_from ${from.join(" ")}`;
const quote = (s: string): string => `'${s.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
const describe = (text?: string): string => (text ? ` -d ${quote(text)}` : "");
const word = (s: string): string => s.replace(/[^\w.,@%+=/:-]/g, "\\$&");

const generator: ShellScriptGenerator = {
  name: "fish",
  completionActivateMessage: (bin) => `${bin} completions fish | source`,
  generate: (root) => {
    const bin = root.name;
    const lines = [`# fish completion for ${bin}`, `complete -c ${bin} -e`];
    const visitNode = (cmd: Command, levels: string[][]) => {
      const conditions = levels.length ? levels.map(seen) : ["__fish_use_subcommand"];
      const when = quote(conditions.join("; and "));

      for (const o of Object.values(cmd.options)) {
        const flags = `${o.short ? `-s ${o.short} ` : ""}-l ${o.name}`;
        let value = "";
        if (o.choices?.length) {
          value = ` -x -a ${quote(o.choices.map((c) => word(String(c))).join(" "))}`;
        } else if (o.type !== "boolean") {
          value = " -r";
        }

        lines.push(`complete -c ${bin} -n ${when} ${flags}${value}${describe(o.description)}`);
      }

      for (const sub of cmd.commands) {
        lines.push(
          `complete -c ${bin} -n ${when} -f -a ${quote(sub.name)}${describe(sub.description)}`,
        );
        visitNode(sub, [...levels, [sub.name, ...sub.alias]]);
      }
    };

    visitNode(root, []);

    return lines.join("\n");
  },
};

export default generator;
