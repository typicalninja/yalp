import { type Command, defineCommand, findSubCommand } from "../command.js";
import { ConfigError } from "../errors.js";
import fish from "./fish.js";

const generators = [fish];

/** Returns a copy of `root` with the built-in `completions` command added. */
export function rootWithCompletionsCommand(root: Command): Command {
  if (findSubCommand(root, "completions")) {
    throw new ConfigError(
      'command "completions" is reserved; pass { completions: false } to define your own',
      { code: "ERR_RESERVED_NAME" },
    );
  }

  const completions = defineCommand({
    name: "completions",
    description: "Generate a shell completion script",
    commands: generators.map((generator) =>
      defineCommand({
        name: generator.name,
        description: `Generate ${generator.name} completion script. Load it with: "${generator.completionActivateMessage(root.name)}"`,
        action: () => console.log(generator.generate(withCompletions)),
      }),
    ),
  });

  // A copy, so the caller's root isn't mutated;
  // generators run lazily and see `completions` in the tree.
  const withCompletions: Command = { ...root, commands: [...root.commands, completions] };
  return withCompletions;
}
