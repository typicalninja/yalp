/** Base class for every error yalp throws. */
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

export type ConfigErrorCode =
  | "ERR_INVALID_NAME"
  | "ERR_DUPLICATE_SUBCOMMAND"
  | "ERR_DUPLICATE_OPTION"
  | "ERR_RESERVED_NAME"
  | "ERR_INVALID_POSITIONAL_ORDER";

export interface ConfigErrorOptions extends ErrorOptions {
  code: ConfigErrorCode;
}

/** Thrown by defineCommand() when a command definition is invalid */
export class ConfigError extends YalpError {
  readonly code: ConfigErrorCode;
  constructor(message: string, options: ConfigErrorOptions) {
    super(message, options);
    this.code = options.code;
  }
}
