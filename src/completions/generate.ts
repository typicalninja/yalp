import { type Command, defineCommand, findSubCommand } from "../command.js";
import { ConfigError } from "../errors.js";
import bash from "./bash.js";
import fish from "./fish.js";
import zsh from "./zsh.js";

const generators = [bash, fish, zsh];

/** Returns a copy of `root` with the built-in `completions` command added. */
export function rootWithCompletionsCommand(root: Command): Command {
  if (findSubCommand(root, "completions")) {
    throw new ConfigError(
      'command "completions" is reserved; pass { completions: false } to define your own',
      { code: "ERR_RESERVED_NAME" },
    );
  }

  const nameWidth = Math.max(...generators.map((generator) => generator.name.length));
  const activation = generators
    .map(
      (generator) =>
        `  ${generator.name.padEnd(nameWidth)}  ${generator.completionActivateMessage(root.name)}`,
    )
    .join("\n");

  const completions = defineCommand({
    name: "completions",
    description: `Generate a shell completion script\n\nTo enable completions, run one of these or add it to your shell's startup file:\n\n${activation}`,
    commands: generators.map((generator) =>
      defineCommand({
        name: generator.name,
        description: `Generate the ${generator.name} completion script`,
        action: () => console.log(generator.generate(withCompletions)),
      }),
    ),
  });

  // A copy, so the caller's root isn't mutated;
  // generators run lazily and see `completions` in the tree.
  const withCompletions: Command = { ...root, commands: [...root.commands, completions] };
  return withCompletions;
}
