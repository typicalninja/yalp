import { findOptionByShort, findSubCommand, type Command } from "./command.js";
import type { Param } from "./parameter.js";

/** Reasons parse() rejects a token. */
export type IssueCode =
  | "ERR_UNKNOWN_OPTION"
  | "ERR_MISSING_VALUE"
  | "ERR_UNEXPECTED_VALUE"
  | "ERR_UNEXPECTED_POSITIONAL"
  | "ERR_MISSING_REQUIRED"
  | "ERR_INVALID_NUMBER"
  | "ERR_INVALID_CHOICE";

/** One problem found while parsing argv. */
export interface Issue {
  code: IssueCode;
  message: string;
  /** Parameter name, when the issue is about one. */
  param?: string;
  /** The offending token, for "did you mean" suggestions. */
  value?: string;
}

interface Resolved {
  command: Command;
  /** Command names from root to matched, for usage lines. */
  path: string[];
}

/**
 * The result of {@link parse}: a successful run, help, or version match, or a failed parse with
 * issues.
 */
export type ParseResult =
  | (Resolved & {
      ok: true;
      kind: "run";
      options: Record<string, unknown>;
      positionals: Record<string, unknown>;
      rest: string[];
    })
  | (Resolved & { ok: true; kind: "help" })
  | (Resolved & { ok: true; kind: "version" })
  | (Resolved & { ok: false; issues: Issue[] });

type Add = (code: IssueCode, message: string, param?: string, value?: string) => void;

const HELP = new Set(["-h", "--help"]);
const VERSION = new Set(["-V", "--version"]);

/** Parses argv against a command tree. Never throws on user input. */
export function parse(
  root: Command,
  argv: string[],
  config: { version?: boolean } = {},
): ParseResult {
  const sep = argv.indexOf("--");
  const head = sep === -1 ? argv : argv.slice(0, sep);
  const rest = sep === -1 ? [] : argv.slice(sep + 1);

  // Strip help before descent: "-h add" must reach "add", not stall on "-h".
  let help = head.some((t) => HELP.has(t));
  const tokens = head.filter((t) => !HELP.has(t));

  let command = root;
  const path = [root.name];
  let i = 0;
  for (; i < tokens.length; i++) {
    const sub = findSubCommand(command, tokens[i]!);
    if (!sub) break;
    command = sub;
    path.push(sub.name);
  }

  if (help) return { ok: true, kind: "help", command, path };

  const issues: Issue[] = [];
  const add: Add = (code, message, param, value) =>
    void issues.push({ code, message, param, value });

  const raw = new Map<string, (string | boolean)[]>();
  /** Marks a param as seen, so a failed read never also reports "missing". */
  const mark = (name: string): (string | boolean)[] => {
    let values = raw.get(name);
    if (!values) {
      values = [];
      raw.set(name, values);
    }
    return values;
  };
  const bare: string[] = [];
  const atRoot = path.length === 1;
  let version = false;

  for (; i < tokens.length; i++) {
    const token = tokens[i]!;

    if (VERSION.has(token) && atRoot && config.version) {
      version = true;
      continue;
    }

    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      let name = eq === -1 ? token.slice(2) : token.slice(2, eq);
      const negated = !command.options[name] && name.startsWith("no-");
      if (negated) name = name.slice(3);

      const option = command.options[name];
      if (!option || (negated && option.type !== "boolean")) {
        add("ERR_UNKNOWN_OPTION", `unknown option "${token}"`, undefined, name);
        continue;
      }

      if (option.type === "boolean") {
        if (eq !== -1) {
          mark(name);
          const flag = token.slice(0, eq);
          add("ERR_UNEXPECTED_VALUE", `"${flag}" is a flag, use --${name} or --no-${name}`, name);
          continue;
        }
        mark(name).push(!negated);
        continue;
      }

      const value = eq === -1 ? tokens[++i] : token.slice(eq + 1);
      if (value === undefined) {
        mark(name);
        add("ERR_MISSING_VALUE", `"--${name}" needs a value`, name);
      } else mark(name).push(value);
      continue;
    }

    // "-" is stdin and "-3" is a negative number: both are positionals.
    if (token.length > 1 && token[0] === "-" && !/^-\d/.test(token)) {
      const chars = token.slice(1);
      for (let c = 0; c < chars.length; c++) {
        const ch = chars[c]!;
        if (ch === "h") {
          help = true;
          continue;
        }
        if (ch === "V" && atRoot && config.version) {
          version = true;
          continue;
        }

        const option = findOptionByShort(command, ch);
        if (!option) {
          add("ERR_UNKNOWN_OPTION", `unknown option "-${ch}"`, undefined, ch);
          continue;
        }
        if (option.type === "boolean") {
          mark(option.name).push(true);
          continue;
        }

        // A value-taking short ends the cluster: -eprod or -e prod.
        const value = chars.slice(c + 1) || tokens[++i];
        if (value === undefined) {
          mark(option.name);
          add("ERR_MISSING_VALUE", `"-${ch}" needs a value`, option.name);
        } else mark(option.name).push(value);
        break;
      }
      continue;
    }

    bare.push(token);
  }

  // Real problems found while scanning always win; help/version never mask them.
  if ((help || version) && issues.length) return { ok: false, command, path, issues };
  if (help) return { ok: true, kind: "help", command, path };
  if (version) return { ok: true, kind: "version", command, path };

  const options: Record<string, unknown> = {};
  for (const option of Object.values(command.options)) {
    options[option.name] = finalize(option, raw.get(option.name), add);
  }

  const positionals: Record<string, unknown> = {};
  let taken = 0;
  for (const param of command.positionals) {
    const slice = param.multiple ? bare.slice(taken) : bare.slice(taken, taken + 1);
    taken += slice.length;
    positionals[param.name] = finalize(param, slice.length ? slice : undefined, add);
  }
  for (const extra of bare.slice(taken)) {
    add("ERR_UNEXPECTED_POSITIONAL", `unexpected argument "${extra}"`, undefined, extra);
  }

  if (issues.length) return { ok: false, command, path, issues };
  return { ok: true, kind: "run", command, path, options, positionals, rest };
}

function finalize(param: Param, values: (string | boolean)[] | undefined, add: Add): unknown {
  if (!values) {
    if (param.default !== undefined) return param.default;
    if (param.required) add("ERR_MISSING_REQUIRED", `"${param.name}" is required`, param.name);
    return param.multiple ? [] : undefined;
  }

  const coerced = values.map((v) => coerce(param, v, add));
  return param.multiple ? coerced : coerced.at(-1);
}

function coerce(param: Param, value: string | boolean, add: Add): unknown {
  // Booleans only ever reach here as real booleans; an inline value already errored.
  if (param.type === "boolean") return value;

  if (param.type === "number") {
    const n = typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
    if (Number.isNaN(n)) {
      add("ERR_INVALID_NUMBER", `"${param.name}" expects a number, got "${value}"`, param.name);
      return undefined;
    }
    return withinChoices(param, n, add);
  }

  return withinChoices(param, String(value), add);
}

function withinChoices(param: Param, value: string | number, add: Add): unknown {
  if (param.choices && !param.choices.includes(value)) {
    add(
      "ERR_INVALID_CHOICE",
      `"${param.name}" must be one of: ${param.choices.join(", ")}`,
      param.name,
      String(value),
    );
    return undefined;
  }
  return value;
}
