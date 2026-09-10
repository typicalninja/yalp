import { defineCommand, run } from "../../dist/index.mjs";
import { addCmd } from "./commands/add.ts";
import { branchCmd } from "./commands/branch.ts";
import { checkoutCmd } from "./commands/checkout.ts";
import { commitCmd } from "./commands/commit.ts";
import { initCmd } from "./commands/init.ts";

// A Command is plain data (see command.ts's own doc comment), so composing
// subcommands is just building an array of them — no factory, no registry.
const cmd = defineCommand({
  name: "git-lite",
  description: "A minimal slice of git's command surface, for demonstration.",
  commands: [initCmd, addCmd, commitCmd, branchCmd, checkoutCmd],
  // No action here on purpose: running `git-lite` with no subcommand falls
  // through to run()'s help-fallback behavior (prints help, exits 2, since
  // this command has subcommands).
});

run(cmd, { version: "1.0.0" });
