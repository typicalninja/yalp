import { describe, expect, it } from "vitest";

import { suggest } from "../src/suggest.js";

describe("suggest", () => {
  it("returns the closest candidate within the edit-distance budget", () => {
    expect(suggest("hlp", ["help", "version"])).toBe("help");
  });

  it("is case-insensitive", () => {
    expect(suggest("HELP", ["help", "version"])).toBe("help");
  });

  it("returns undefined when no candidate is close enough", () => {
    expect(suggest("xyz", ["help", "version"])).toBeUndefined();
  });

  it("never suggests the exact input back as its own correction", () => {
    expect(suggest("help", ["help", "version"])).toBeUndefined();
  });

  it("returns undefined for an empty candidate list", () => {
    expect(suggest("help", [])).toBeUndefined();
  });

  it("prefers the candidate with the smaller edit distance", () => {
    // "colr" is 1 edit from "color" and 4 from "collection"
    expect(suggest("colr", ["color", "collection"])).toBe("color");
  });

  it("scales the distance budget with input length", () => {
    // budget = max(2, floor(len/3)); for a 12-char input the budget is 4
    expect(suggest("configuratoin", ["configuration"])).toBe("configuration");
  });
});
