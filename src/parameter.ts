/** The primitive types a parameter's value can hold. */
export type ParamType = "string" | "number" | "boolean";

type TypeMap = { string: string; number: number; boolean: boolean };

/** What a user writes. Every field optional; `type` defaults to "string". */
export interface ParamSpec {
  type?: ParamType;
  short?: string;
  description?: string;
  required?: boolean;
  multiple?: boolean;
  default?: string | number | boolean | readonly (string | number | boolean)[];
  choices?: readonly (string | number)[];
}

/** A spec after defineCommand fills in `name` and `type`. */
export interface Param extends ParamSpec {
  name: string;
  type: ParamType;
}

type ElementOf<S extends ParamSpec> = S["choices"] extends readonly (infer C)[]
  ? C
  : S["type"] extends ParamType
    ? TypeMap[S["type"]]
    : string;

/** What the action receives for one parameter. */
export type ParamValue<S extends ParamSpec> = S["multiple"] extends true
  ? ElementOf<S>[]
  : S["required"] extends true
    ? ElementOf<S>
    : undefined extends S["default"]
      ? ElementOf<S> | undefined
      : ElementOf<S>;
