import { describe, expect, it } from "vitest";

import { suggest } from "../src/suggest.js";

describe("suggest", () => {
  it.each([
    ["a typo", "hlp", ["help", "version"], "help"],
    ["a different case", "HELP", ["help", "version"], "help"],
    ["the nearest of several", "colr", ["collection", "color"], "color"],
    // the budget is max(2, floor(length / 3)), so long inputs tolerate more edits
    ["a long input with a wider budget", "configuratoin", ["configuration"], "configuration"],
  ])("suggests a candidate for %s", (_label, input, candidates, expected) => {
    expect(suggest(input, candidates)).toBe(expected);
  });

  it.each([
    ["nothing is close enough", "xyz", ["help", "version"]],
    ["the input is itself a candidate", "help", ["help", "version"]],
  ])("suggests nothing when %s", (_label, input, candidates) => {
    expect(suggest(input, candidates)).toBeUndefined();
  });
});
