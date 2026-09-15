import { ConfigError, type ConfigErrorCode } from "./errors.js";
import type { Param, ParamSpec, ParamValue } from "./parameter.js";

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const SHORT = /^[a-zA-Z]$/;
const RESERVED = new Set(["help", "version"]);
const RESERVED_SHORT = new Set(["h", "V"]);

type Specs = Record<string, ParamSpec>;

/**
 * An example invocation shown under "Examples:" in help output. A plain string is the arguments to
 * append after the command's own path (e.g. `"--watch"`); a `[args, note]` tuple adds a
 * description.
 */
export type Example = string | readonly [args: string, note: string];

/** Arguments passed to a command's action function. */
export interface ActionArgs<O extends Specs, P extends Specs> {
  options: { [K in keyof O]: ParamValue<O[K]> };
  positionals: { [K in keyof P]: ParamValue<P[K]> };
  /** Arguments after `--`, in order. */
  rest: string[];
}

/** Type-erased action stored on a built command. */
export type CommandAction = (args: {
  options: Record<string, unknown>;
  positionals: Record<string, unknown>;
  rest: string[];
}) => unknown;

/** A built command. Plain data: the parser reads it, nothing mutates it. */
export interface Command {
  name: string;
  description?: string;
  examples?: Example[];
  alias: string[];
  options: Record<string, Param>;
  positionals: Param[];
  commands: Command[];
  action?: CommandAction;
}

function check(ok: unknown, code: ConfigErrorCode, message: string): asserts ok {
  if (!ok) throw new ConfigError(message, { code });
}

/**
 * Defines a command. Validates eagerly, so a malformed definition throws at import time rather than
 * when an end user happens to hit that code path.
 */
export function defineCommand<const O extends Specs = {}, const P extends Specs = {}>(config: {
  name: string;
  description?: string;
  /** Example invocations shown under "Examples:" in help output. */
  examples?: Example[];
  alias?: string[];
  options?: O;
  positionals?: P;
  commands?: Command[];
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

    options[key] = { type: "string", ...spec, name: key };
  }

  const positionals: Param[] = [];
  for (const [key, spec] of Object.entries(config.positionals ?? {})) {
    check(NAME.test(key), "ERR_INVALID_NAME", `positional "${key}" must be kebab-case`);

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
