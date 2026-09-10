import { defineCommand, parse } from "../../dist/index.mjs";

const cmd = defineCommand({
  name: "greet-raw",
  description: "Greet someone (manual parse() usage).",
  positionals: {
    name: { description: "Who to greet", required: true },
  },
  options: {
    loud: { type: "boolean", short: "l", description: "Uppercase the greeting" },
  },
});

const result = parse(cmd, process.argv.slice(2));

if (!result.ok) {
  for (const issue of result.issues) console.error(`error: ${issue.message}`);
  process.exitCode = 2;
} else if (result.kind === "help") {
  console.log("(this example owns its own output, so it skips yalp's built-in help text)");
} else if (result.kind === "version") {
  // Unreachable here: this example never passes a version string to parse().
  console.log("(no version configured)");
} else {
  const name = String(result.positionals.name);
  console.log(result.options.loud ? `>>> HELLO, ${name.toUpperCase()} <<<` : `hi, ${name}`);
}
