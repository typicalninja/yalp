import { describe, expect, it } from "vitest";

import type { Command } from "../src/command.js";
import { ConfigError } from "../src/errors.js";
import { loadFromDirectory } from "../src/load.js";

const fixture = (name: string) => new URL(`./fixtures/load/${name}/`, import.meta.url);
const byName = (commands: Command[]) => new Map(commands.map((c) => [c.name, c]));

describe("loadFromDirectory: root", () => {
  it("returns file commands directly, without wrapping the root in a group", async () => {
    const commands = await loadFromDirectory(fixture("good"));
    expect(commands.map((c) => c.name).sort()).toEqual([
      "Weird_Dir",
      "config",
      "hello",
      "plain-group",
      "world",
    ]);
  });

  it("skips files with an unrecognized or missing extension", async () => {
    const commands = await loadFromDirectory(fixture("good"));
    expect(commands.map((c) => c.name)).not.toContain("readme");
  });

  it("accepts a string directory path with or without a trailing slash", async () => {
    const withSlash = fixture("good").pathname;
    const withoutSlash = withSlash.replace(/\/$/, "");
    expect((await loadFromDirectory(withSlash)).map((c) => c.name).sort()).toEqual(
      (await loadFromDirectory(withoutSlash)).map((c) => c.name).sort(),
    );
  });
});

describe("loadFromDirectory: subdirectory groups", () => {
  it("names a bare group after the directory as-is, without kebab-case validation", async () => {
    const group = byName(await loadFromDirectory(fixture("good"))).get("Weird_Dir")!;
    expect(group.commands.map((c) => c.name)).toEqual(["child"]);
  });

  it("builds a bare, action-less group from a directory with no index file", async () => {
    const group = byName(await loadFromDirectory(fixture("good"))).get("plain-group")!;
    expect(group.action).toBeUndefined();
    expect(group.commands.map((c) => c.name).sort()).toEqual(["leaf", "nested"]);
  });

  it("recurses into nested subdirectories", async () => {
    const plainGroup = byName(await loadFromDirectory(fixture("good"))).get("plain-group")!;
    const nested = byName(plainGroup.commands).get("nested")!;
    expect(nested.commands.map((c) => c.name)).toEqual(["deep"]);
  });

  it("takes a group's own definition from its index file, keeping discovered commands", async () => {
    const config = byName(await loadFromDirectory(fixture("good"))).get("config")!;
    expect(config.description).toBe("manage configuration");
    expect(config.commands.map((c) => c.name).sort()).toEqual(["get", "set"]);
  });
});

describe("loadFromDirectory: validation", () => {
  it("rejects a file whose command name doesn't match its filename", async () => {
    await expect(loadFromDirectory(fixture("bad-name-mismatch"))).rejects.toThrow(ConfigError);
  });

  it("rejects an index file whose command name doesn't match its directory", async () => {
    await expect(loadFromDirectory(fixture("bad-index-mismatch"))).rejects.toThrow(ConfigError);
  });

  it.each([
    ["a default export that isn't command-shaped", "bad-shape"],
    ["a null default export", "bad-null"],
    ["a non-object default export", "bad-string"],
  ])("rejects %s with ERR_INVALID_MODULE", async (_label, dir) => {
    try {
      await loadFromDirectory(fixture(dir));
      throw new Error("expected loadFromDirectory to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).code).toBe("ERR_INVALID_MODULE");
    }
  });
});
