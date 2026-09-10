import { defineCommand } from "../../../dist/index.mjs";

export const commitCmd = defineCommand({
  name: "commit",
  description: "Record staged changes.",
  options: {
    message: { short: "m", required: true, description: "Commit message" },
    amend: { type: "boolean", description: "Amend the previous commit" },
    verify: {
      type: "boolean",
      default: true,
      description: "Run pre-commit hooks (disable with --no-verify)",
    },
    trailer: {
      multiple: true,
      description: "Append a trailer line, e.g. 'Reviewed-by: name' (repeatable)",
    },
  },
  action: ({ options }) => {
    const kind = options.amend ? "Amended commit" : "Commit";
    console.log(`${kind}: "${options.message}"`);
    if (!options.verify) console.log("(hooks skipped: --no-verify)");
    for (const trailer of options.trailer) console.log(`  ${trailer}`);
  },
});
