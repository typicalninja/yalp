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

  // Copy so the user's root isn't mutated, while generators still see `completions` in the tree.
  const rootCopy = { ...root };
  const bin = rootCopy.name;
  const completions = defineCommand({
    name: "completions",
    description: "Generate a shell completion script",
    commands: generators.map((generator) =>
      defineCommand({
        name: generator.name,
        description: `Generate ${generator.name} completion script. Load it with: "${generator.completionActivateMessage(bin)}"`,
        action: () => console.log(generator.generate(rootCopy)),
      }),
    ),
  });

  rootCopy.commands = [...rootCopy.commands, completions];

  return rootCopy;
}
