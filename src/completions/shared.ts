export type Shell = "bash" | "zsh" | "fish";

export interface ShellScriptGenerator {
  name: Shell;
  completionActivateMessage: (bin: string) => string;
  generate: () => string;
}
