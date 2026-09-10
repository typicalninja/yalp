import { defineCommand } from "../../../dist/index.mjs";

export const initCmd = defineCommand({
  name: "init",
  description: "Create an empty repository.",
  action: () => {
    console.log("Initialized empty git-lite repository.");
  },
});
