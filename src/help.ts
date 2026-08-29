import type { Command } from "./command.js";
import type { Param } from "./parameter.js";

const slot = (p: Param) =>
  `${p.required ? "<" : "["}${p.name}${p.multiple ? "..." : ""}${p.required ? ">" : "]"}`;

const flag = (p: Param) =>
  p.type === "boolean"
    ? `${p.short ? `-${p.short}, ` : "    "}--[no-]${p.name}`
    : `${p.short ? `-${p.short}, ` : "    "}--${p.name} <value${p.multiple ? "..." : ""}>`;

function note(p: Param): string {
  const parts: string[] = [];
  if (p.description) parts.push(p.description);
  if (p.choices) parts.push(`(${p.choices.join(" | ")})`);
  if (p.default !== undefined) parts.push(`(default: ${p.default})`);
  else if (p.required) parts.push("(required)");
  return parts.join(" ");
}

function table(rows: [string, string][]): string {
  const width = Math.max(...rows.map(([left]) => left.length));
  return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`.trimEnd()).join("\n");
}

export function help(cmd: Command, path: string[], version?: string): string {
  const options = Object.values(cmd.options);
  const usage = [
    path.join(" "),
    cmd.commands.length ? "[command]" : "",
    options.length ? "[options]" : "",
    ...cmd.positionals.map(slot),
  ]
    .filter(Boolean)
    .join(" ");

  const out = [`Usage: ${usage}`];
  if (cmd.description) out.push("", cmd.description);

  if (cmd.commands.length) {
    out.push("", "Commands:");
    out.push(
      table(cmd.commands.map((c) => [[c.name, ...c.alias].join(", "), c.description ?? ""])),
    );
  }
  if (cmd.positionals.length) {
    out.push("", "Arguments:");
    out.push(table(cmd.positionals.map((p) => [slot(p), note(p)])));
  }

  const rows: [string, string][] = options.map((p) => [flag(p), note(p)]);
  rows.push(["-h, --help", "Show this help"]);
  if (version && path.length === 1) rows.push(["-V, --version", "Show version"]);
  out.push("", "Options:", table(rows));

  return out.join("\n");
}
