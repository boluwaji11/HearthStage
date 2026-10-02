/**
 * STG-13, ST17.4. The catalogue, and the two things it has to get right.
 */
import { describe, it, expect } from "vitest";
import { en, plural, t } from "../src/index";

describe("the catalogue", () => {
  it("has no empty message", () => {
    const empty = Object.entries(en).filter(([, value]) => value.trim() === "");
    expect(empty).toEqual([]);
  });

  it("holds no em dash, which the house style refuses everywhere", () => {
    const dashed = Object.entries(en).filter(([, value]) => /[—–]/.test(value));
    expect(dashed).toEqual([]);
  });

  it("gives every plural stem both of the forms English needs", () => {
    const stems = new Set(
      Object.keys(en)
        .filter((key) => key.endsWith(".one") || key.endsWith(".other"))
        .map((key) => key.replace(/\.(one|other)$/, "")),
    );
    for (const stem of stems) {
      expect(Object.keys(en), stem).toContain(`${stem}.one`);
      expect(Object.keys(en), stem).toContain(`${stem}.other`);
    }
  });
});

describe("looking a message up", () => {
  it("returns it", () => {
    expect(t("library.new")).toBe("New");
  });

  it("fills in what it is given", () => {
    expect(t("status.output", { name: "Main", display: "HP 24mh" })).toBe("Main: HP 24mh");
  });

  it("leaves a placeholder nobody filled, so a defect looks like one", () => {
    expect(t("status.output", { name: "Main" })).toBe("Main: {display}");
  });

  it("counts in the words English uses", () => {
    expect(plural("library.slides", 1)).toBe("1 slide");
    expect(plural("library.slides", 4)).toBe("4 slides");
    expect(plural("library.slides", 0)).toBe("0 slides");
  });
});
