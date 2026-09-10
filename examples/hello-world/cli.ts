import { defineCommand, run } from "../../dist/index.mjs";

const cmd = defineCommand({
  name: "hello",
  description: "Greet someone.",
  positionals: {
    name: { description: "Who to greet", default: "World" },
  },
  options: {
    shout: { type: "boolean", short: "s", description: "Uppercase the greeting" },
    times: { type: "number", short: "t", default: 1, description: "Repeat the greeting" },
  },
  action: ({ positionals, options }) => {
    let greeting = `Hello, ${positionals.name}!`;
    if (options.shout) greeting = greeting.toUpperCase();
    for (let i = 0; i < options.times; i++) console.log(greeting);
  },
});

await run(cmd);
