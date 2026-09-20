import { ConfigError, type ConfigErrorCode } from "./errors.js";
import type { Param, ParamSpec, ParamValue } from "./parameter.js";

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const SHORT = /^[a-zA-Z]$/;
const RESERVED = new Set(["help", "version"]);
const RESERVED_SHORT = new Set(["h", "V"]);

type Specs = Record<string, ParamSpec>;

/**
 * Example invocation. A string is the arguments that follow the command path. A `[args, note]`
 * tuple adds a description.
 */
export type Example = string | readonly [args: string, note: string];

/** Argument of a command's `action`. */
export interface ActionArgs<O extends Specs, P extends Specs> {
  /** Parsed options, keyed by option name. */
  options: { [K in keyof O]: ParamValue<O[K]> };
  /** Parsed positional arguments, keyed by positional name. */
  positionals: { [K in keyof P]: ParamValue<P[K]> };
  /** Arguments after a literal `--`, unparsed and in order. */
  rest: string[];
}

/** Type-erased action stored on a built command. */
export type CommandAction = (args: {
  options: Record<string, unknown>;
  positionals: Record<string, unknown>;
  rest: string[];
}) => unknown;

/** A command, as returned by `defineCommand`. Plain data that nothing modifies after creation. */
export interface Command {
  /** Command name. */
  name: string;
  /** Help text. Only the first line is listed in a parent's help. */
  description?: string;
  /** Example invocations listed in help. */
  examples?: Example[];
  /** Alternative names. */
  alias: string[];
  /** Options, keyed by name. */
  options: Record<string, Param>;
  /** Positional arguments, in fill order. */
  positionals: Param[];
  /** Subcommands. */
  commands: Command[];
  /** Handler, with argument types erased. */
  action?: CommandAction;
}

function check(ok: unknown, code: ConfigErrorCode, message: string): asserts ok {
  if (!ok) throw new ConfigError(message, { code });
}

/** Rejects a declaration whose fields contradict each other. */
function checkParam(kind: "option" | "positional", key: string, spec: ParamSpec): void {
  const at = `${kind} "${key}"`;
  const type = spec.type ?? "string";
  const { choices, default: fallback } = spec;

  if (choices) {
    check(type !== "boolean", "ERR_INVALID_PARAM", `${at} is a boolean and cannot have choices`);
    check(choices.length > 0, "ERR_INVALID_PARAM", `${at} has empty choices`);
    check(
      choices.every((c) => typeof c === type),
      "ERR_INVALID_PARAM",
      `${at} choices must be of type ${type}`,
    );
  }

  if (fallback === undefined) return;
  const isArray = Array.isArray(fallback);
  check(
    isArray === Boolean(spec.multiple),
    "ERR_INVALID_PARAM",
    `${at} default must ${spec.multiple ? "" : "not "}be an array`,
  );
  const values: readonly unknown[] = isArray ? fallback : [fallback];
  check(
    values.every((v) => typeof v === type),
    "ERR_INVALID_PARAM",
    `${at} default must be of type ${type}`,
  );
  check(
    !choices || values.every((v) => choices.some((c) => c === v)),
    "ERR_INVALID_PARAM",
    `${at} default must be one of its choices`,
  );
}

/**
 * Defines a command.
 *
 * Validates the definition and returns it as plain data. Option and positional types are inferred
 * from their declarations and reach `action`.
 *
 * @example
 *   const greet = defineCommand({
 *     name: "greet",
 *     action: () => console.log("Hello!"),
 *   });
 *
 * @param config - The command definition.
 * @returns The command.
 * @throws {ConfigError} When a name is not kebab-case, a name is reserved or duplicated,
 *   positionals are misordered, or a parameter's fields contradict each other.
 */
export function defineCommand<const O extends Specs = {}, const P extends Specs = {}>(config: {
  /** Command name. Kebab-case. */
  name: string;
  /** Help text. Only the first line is listed in a parent's help. */
  description?: string;
  /** Example invocations listed in help. */
  examples?: Example[];
  /** Alternative names. Kebab-case, unique among sibling commands. */
  alias?: string[];
  /** Options, keyed by kebab-case name. */
  options?: O;
  /** Positional arguments, keyed by kebab-case name and filled in declaration order. */
  positionals?: P;
  /** Subcommands. */
  commands?: Command[];
  /** Handler. Receives the parsed `options`, `positionals`, and `rest`. May be async. */
  action?: (args: ActionArgs<O, P>) => unknown;
}): Command {
  const { name, description, examples, alias = [], commands = [] } = config;

  check(NAME.test(name), "ERR_INVALID_NAME", `command "${name}" must be kebab-case`);
  for (const a of alias) check(NAME.test(a), "ERR_INVALID_NAME", `alias "${a}" must be kebab-case`);

  const options: Record<string, Param> = {};
  const shorts = new Set<string>();

  for (const [key, spec] of Object.entries(config.options ?? {})) {
    check(NAME.test(key), "ERR_INVALID_NAME", `option "${key}" must be kebab-case`);
    check(!RESERVED.has(key), "ERR_RESERVED_NAME", `option "${key}" is reserved`);
    check(!key.startsWith("no-"), "ERR_RESERVED_NAME", `option "${key}" cannot start with "no-"`);

    const { short } = spec;
    if (short) {
      check(SHORT.test(short), "ERR_INVALID_NAME", `short "-${short}" must be one letter`);
      check(!RESERVED_SHORT.has(short), "ERR_RESERVED_NAME", `short "-${short}" is reserved`);
      check(!shorts.has(short), "ERR_DUPLICATE_OPTION", `short "-${short}" is already used`);
      shorts.add(short);
    }

    checkParam("option", key, spec);
    options[key] = { type: "string", ...spec, name: key };
  }

  const positionals: Param[] = [];
  for (const [key, spec] of Object.entries(config.positionals ?? {})) {
    check(NAME.test(key), "ERR_INVALID_NAME", `positional "${key}" must be kebab-case`);
    check(!spec.short, "ERR_INVALID_PARAM", `positional "${key}" cannot have a short`);
    checkParam("positional", key, spec);

    const prev = positionals.at(-1);
    check(
      !prev?.multiple,
      "ERR_INVALID_POSITIONAL_ORDER",
      `"${key}" cannot follow variadic "${prev?.name}"`,
    );
    check(
      !prev || prev.required || !spec.required,
      "ERR_INVALID_POSITIONAL_ORDER",
      `required "${key}" cannot follow optional "${prev?.name}"`,
    );

    positionals.push({ type: "string", ...spec, name: key });
  }

  const taken = new Set<string>();
  for (const sub of commands) {
    for (const n of [sub.name, ...sub.alias]) {
      check(!taken.has(n), "ERR_DUPLICATE_SUBCOMMAND", `subcommand "${n}" clashes`);
      taken.add(n);
    }
  }

  return {
    name,
    description,
    examples,
    alias,
    options,
    positionals,
    commands,
    action: config.action as CommandAction | undefined,
  };
}

export const findOptionByShort = (cmd: Command, ch: string): Param | undefined =>
  Object.values(cmd.options).find((o) => o.short === ch);

export const findSubCommand = (cmd: Command, token: string): Command | undefined =>
  cmd.commands.find((c) => c.name === token || c.alias.includes(token));
