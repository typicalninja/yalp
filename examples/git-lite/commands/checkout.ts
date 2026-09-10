import { defineCommand } from "../../../dist/index.mjs";

export const checkoutCmd = defineCommand({
  name: "checkout",
  alias: ["co"],
  description: "Switch branches, or restore paths from one.",
  positionals: {
    branch: { description: "Branch to check out", required: true },
  },
  action: ({ positionals, rest }) => {
    console.log(`Switched to branch '${positionals.branch}'.`);
    // Everything after a literal "--" is untouched by yalp's parser, just like
    // real git's own `checkout <tree> -- <pathspec>` syntax.
    if (rest.length) {
      console.log(`Restoring from '${positionals.branch}': ${rest.join(", ")}`);
    }
  },
});
