import type { Command } from "../command.js";

export type Shell = "bash" | "zsh" | "fish";

export interface ShellScriptGenerator {
  name: Shell;
  completionActivateMessage: (bin: string) => string;
  generate: (root: Command) => string;
}

/**
 * Single-quotes `s` for POSIX-style shells (bash, zsh), where the only special character inside is
 * `'`.
 */
export const posixQuote = (s: string): string => `'${s.replaceAll("'", "'\\''")}'`;
