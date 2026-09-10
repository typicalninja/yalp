import { defineCommand } from "../../../dist/index.mjs";

export const addCmd = defineCommand({
  name: "add",
  description: "Stage files.",
  positionals: {
    files: { description: "Paths to stage", multiple: true, required: true },
  },
  action: ({ positionals }) => {
    console.log(`Staged: ${positionals.files.join(", ")}`);
  },
});
