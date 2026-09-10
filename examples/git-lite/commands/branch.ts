import { defineCommand } from "../../../dist/index.mjs";

export const branchCmd = defineCommand({
  name: "branch",
  alias: ["br"],
  description: "Create or list branches.",
  positionals: {
    name: { description: "Name of the branch to create" },
  },
  options: {
    sort: {
      choices: ["refname", "committerdate"],
      default: "refname",
      description: "Field to sort the branch list by",
    },
  },
  action: ({ positionals, options }) => {
    if (positionals.name) console.log(`Created branch '${positionals.name}'.`);
    else console.log(`Branches (sorted by ${options.sort}): main, feature-x`);
  },
});
