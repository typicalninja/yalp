/** Value type of a parameter. */
export type ParamType = "string" | "number" | "boolean";

type TypeMap = { string: string; number: number; boolean: boolean };

/**
 * Declaration of an option or positional.
 *
 * @example
 *   { type: "number", short: "t", default: 1, description: "Repeat the greeting" }
 */
export interface ParamSpec {
  /**
   * Value type.
   *
   * @default "string"
   */
  type?: ParamType;
  /** One-letter option alias, used as `-x`. `h` and `V` are reserved. */
  short?: string;
  /** Help text. */
  description?: string;
  /** Omission is an error unless `default` is set. */
  required?: boolean;
  /** Collects repeated occurrences into an array. On a positional, valid only in the last position. */
  multiple?: boolean;
  /** Value used when the parameter is omitted. */
  default?: string | number | boolean | readonly (string | number | boolean)[];
  /** Permitted values. Narrows the value's type. */
  choices?: readonly (string | number)[];
}

/** A `ParamSpec` with its `name` and `type` resolved. */
export interface Param extends ParamSpec {
  /** Parameter name. */
  name: string;
  /** Value type. */
  type: ParamType;
}

type ElementOf<S extends ParamSpec> = S["choices"] extends readonly (infer C)[]
  ? C
  : S["type"] extends ParamType
    ? TypeMap[S["type"]]
    : string;

/**
 * Type of the value an action receives for the declaration `S`.
 *
 * `multiple` yields an array, `required` or `default` removes `undefined`, and `choices` narrows
 * the type to a union of the listed values.
 */
export type ParamValue<S extends ParamSpec> = S["multiple"] extends true
  ? ElementOf<S>[]
  : S["required"] extends true
    ? ElementOf<S>
    : undefined extends S["default"]
      ? ElementOf<S> | undefined
      : ElementOf<S>;
