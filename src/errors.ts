/** Base class of yalp errors. */
export abstract class YalpError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    if ("captureStackTrace" in Error) {
      // Avoid YalpError itself in the stack trace
      Error.captureStackTrace(this, new.target);
    }
  }
}

/** Reasons a command definition is rejected. */
export type ConfigErrorCode =
  /** A name is not kebab-case, or a `short` is not one letter. */
  | "ERR_INVALID_NAME"
  /** Two sibling commands share a name or alias. */
  | "ERR_DUPLICATE_SUBCOMMAND"
  /** Two options of one command share a `short`. */
  | "ERR_DUPLICATE_OPTION"
  /** A name or `short` is reserved, or `completions` is defined at the root. */
  | "ERR_RESERVED_NAME"
  /** A required positional follows an optional one, or any positional follows a variadic one. */
  | "ERR_INVALID_POSITIONAL_ORDER"
  /** A parameter's fields contradict each other, such as a `default` outside its `choices`. */
  | "ERR_INVALID_PARAM";

/** Constructor options for {@link ConfigError}. */
export interface ConfigErrorOptions extends ErrorOptions {
  /** The rule that was violated. */
  code: ConfigErrorCode;
}

/** Thrown for an invalid command definition. */
export class ConfigError extends YalpError {
  /** The rule that was violated. */
  readonly code: ConfigErrorCode;
  constructor(message: string, options: ConfigErrorOptions) {
    super(message, options);
    this.code = options.code;
  }
}
