import type { Command } from "../command.js";
import { ShellScriptGenerator } from "./shared.js";

const seen = (from: string[]) => `__fish_seen_subcommand_from ${from.join(" ")}`;
const fishQuote = (s: string): string => `'${s.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
const describe = (text?: string): string => (text ? ` -d ${fishQuote(text)}` : "");
const word = (s: string): string => s.replace(/[^\w.,@%+=/:-]/g, "\\$&");

const generator: ShellScriptGenerator = {
  name: "fish",
  completionActivateMessage: (bin) => `${bin} completions fish | source`,
  generate: (root) => {
    const bin = root.name;
    const lines = [`# fish completion for ${bin}`, `complete -c ${bin} -e`];
    const visitNode = (cmd: Command, levels: string[]) => {
      // Active once every ancestor was typed and none of this command's own subcommands has been.
      const conditions = [...levels];
      if (cmd.commands.length) {
        conditions.push(`not ${seen(cmd.commands.flatMap((c) => [c.name, ...c.alias]))}`);
      }
      const when = conditions.length ? ` -n ${fishQuote(conditions.join("; and "))}` : "";

      for (const o of Object.values(cmd.options)) {
        const flags = `${o.short ? `-s ${o.short} ` : ""}-l ${o.name}`;
        let value = "";
        if (o.choices?.length) {
          value = ` -x -a ${fishQuote(o.choices.map((c) => word(String(c))).join(" "))}`;
        } else if (o.type !== "boolean") {
          value = " -r";
        }

        lines.push(`complete -c ${bin}${when} ${flags}${value}${describe(o.description)}`);
      }

      for (const sub of cmd.commands) {
        lines.push(
          `complete -c ${bin}${when} -f -a ${fishQuote(sub.name)}${describe(sub.description)}`,
        );
        visitNode(sub, [...levels, seen([sub.name, ...sub.alias])]);
      }
    };

    visitNode(root, []);

    return lines.join("\n");
  },
};

export default generator;
