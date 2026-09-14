import { readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import type { Command } from "./command.js";
import { ConfigError } from "./errors.js";

const LOADABLE = new Set([".js", ".mjs", ".cjs", ".ts", ".mts"]);
const INDEX = "index";

/**
 * Builds a command tree from a directory. Each file default-exports a command built by
 * `defineCommand`; its name must match the filename (without extension). A subdirectory becomes a
 * subcommand group named after itself, containing the commands built from its own files and
 * subdirectories in turn. A group takes its own name/description/options/action from an `index`
 * file inside it (whose exported name must match the directory name) when one exists, otherwise
 * it's a bare, action-less group named after the directory as-is. The root directory itself never
 * becomes a group; `loadFromDirectory` returns its contents directly.
 */
export async function loadFromDirectory(dir: string | URL): Promise<Command[]> {
  const base = normalize(dir);
  const { files, groups } = await scan(base);
  return [...files, ...groups];
}

interface Scanned {
  files: Command[];
  groups: Command[];
  index?: Command;
}

async function scan(base: URL): Promise<Scanned> {
  const entries = await readdir(base, { withFileTypes: true });

  const files: Command[] = [];
  const groups: Command[] = [];
  let index: Command | undefined;

  for (const entry of entries) {
    if (entry.isDirectory()) {
      groups.push(await loadGroup(new URL(`${entry.name}/`, base), entry.name));
      continue;
    }

    const stem = loadableStem(entry.name);
    if (stem === undefined) continue;

    const href = new URL(entry.name, base).href;
    const command = asCommand(await import(href), href);
    if (stem === INDEX) {
      index = command;
      continue;
    }
    verifyName(command, stem, href);
    files.push(command);
  }

  return { files, groups, index };
}

async function loadGroup(base: URL, dirName: string): Promise<Command> {
  const { files, groups, index } = await scan(base);
  const commands = [...files, ...groups];

  if (index) {
    verifyName(index, dirName, new URL("index", base).href);
    return { ...index, commands };
  }
  return { name: dirName, alias: [], options: {}, positionals: [], commands, action: undefined };
}

function loadableStem(filename: string): string | undefined {
  const dot = filename.lastIndexOf(".");
  if (dot === -1 || !LOADABLE.has(filename.slice(dot))) return undefined;
  return filename.slice(0, dot);
}

function normalize(dir: string | URL): URL {
  if (dir instanceof URL) return dir;
  return pathToFileURL(dir.endsWith("/") ? dir : `${dir}/`);
}

function asCommand(mod: unknown, href: string): Command {
  const command = (mod as { default?: unknown }).default;
  const ok =
    typeof command === "object" &&
    command !== null &&
    typeof (command as Command).name === "string";

  check(ok, `"${href}" must default-export a command built by defineCommand()`);
  return command as Command;
}

function verifyName(command: Command, expected: string, href: string): void {
  check(
    command.name === expected,
    `"${href}" exports a command named "${command.name}", expected "${expected}"`,
  );
}

function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new ConfigError(message, { code: "ERR_INVALID_MODULE" });
}
