import { findOptionByShort, findSubCommand, type Command } from "./command.js";
import type { Param } from "./parameter.js";

/** Reasons {@link parse} reports a problem. */
export type IssueCode =
  /** The word is not an option of the command. */
  | "ERR_UNKNOWN_OPTION"
  /** An option that takes a value has none. */
  | "ERR_MISSING_VALUE"
  /** A boolean flag was given a value. */
  | "ERR_UNEXPECTED_VALUE"
  /** A word fits no positional. */
  | "ERR_UNEXPECTED_POSITIONAL"
  /** A required parameter is missing. */
  | "ERR_MISSING_REQUIRED"
  /** A `number` parameter received text that is not a number. */
  | "ERR_INVALID_NUMBER"
  /** A `boolean` positional received a word other than `true` or `false`. */
  | "ERR_INVALID_BOOLEAN"
  /** A value is outside the parameter's `choices`. */
  | "ERR_INVALID_CHOICE";

/** One problem found while parsing. */
export interface Issue {
  /** Identifies the kind of problem. */
  code: IssueCode;
  /** Human-readable description. */
  message: string;
  /** Parameter name, when the issue concerns a parameter. */
  param?: string;
  /** The offending word, when there is one. */
  value?: string;
}

interface Resolved {
  /** The command the arguments resolved to. */
  command: Command;
  /** Command names from the root to `command`. */
  path: string[];
}

/**
 * Result of {@link parse}. Check `ok` first, then `kind`.
 *
 * When `ok` is `false`, `issues` lists every problem found.
 */
export type ParseResult =
  /** Valid arguments. */
  | (Resolved & {
      ok: true;
      kind: "run";
      /** Parsed options, keyed by option name. */
      options: Record<string, unknown>;
      /** Parsed positional arguments, keyed by positional name. */
      positionals: Record<string, unknown>;
      /** Arguments after a literal `--`. */
      rest: string[];
    })
  /** Help was requested. */
  | (Resolved & { ok: true; kind: "help" })
  /** The version was requested. */
  | (Resolved & { ok: true; kind: "version" })
  /** The arguments were invalid. */
  | (Resolved & { ok: false; issues: Issue[] });

type Add = (code: IssueCode, message: string, param?: string, value?: string) => void;

const HELP = new Set(["-h", "--help"]);
const VERSION = new Set(["-V", "--version"]);

/**
 * Parses arguments against a command tree without printing or running anything.
 *
 * Invalid user input is reported in the result and never thrown.
 *
 * @example
 *   const result = parse(cli, process.argv.slice(2));
 *   if (!result.ok) console.error(result.issues);
 *
 * @param root - The root command.
 * @param argv - The arguments, without the executable and script path.
 * @param config - Parse options.
 * @returns The {@link ParseResult}.
 */
export function parse(
  root: Command,
  argv: string[],
  config: {
    /**
     * Enables `-V` and `--version` on the root command.
     *
     * @default false
     */
    version?: boolean;
  } = {},
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
  if (param.type === "boolean") {
    // A flag arrives as a boolean; a positional arrives as the word `true` or `false`.
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "false") return value === "true";
    add(
      "ERR_INVALID_BOOLEAN",
      `"${param.name}" expects true or false, got "${value}"`,
      param.name,
      value,
    );
    return undefined;
  }

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
