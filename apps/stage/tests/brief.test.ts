/**
 * STG-27, ST12.10. The card a volunteer reads at 10:28.
 *
 * The failure this is written against is not a bug, it is drift: a key that
 * works and is written down nowhere, or written down and no longer working.
 * One table in the window drives what the keys do, the strip along the bottom
 * and the card, so the three cannot disagree. These tests hold that shape in
 * place, because the shape is the whole guarantee.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { en } from "@hearth/stage-i18n";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(join(root, "src/control/control.ts"), "utf8");
const markup = readFileSync(join(root, "src/control/index.html"), "utf8");

/** The table, as it is written in the window. */
function table(): string {
  const at = source.indexOf("const KEYS: KeyRow[] = [");
  const end = source.indexOf("\n];", at);
  expect(at, "the key table").toBeGreaterThan(-1);
  return source.slice(at, end);
}

describe("the keys", () => {
  it("are dispatched from the table and from nowhere else", () => {
    // One listener, one lookup. A second switch on `event.key` anywhere in this
    // window is a key the card cannot know about.
    expect([...source.matchAll(/addEventListener\("keydown"/g)]).toHaveLength(1);
    expect(source).toContain("KEYS.find((candidate) => candidate.keys.includes(event.key))");
    const handler = source.slice(source.indexOf("function onKey"));
    expect(handler.slice(0, handler.indexOf("\n}\n"))).not.toMatch(/switch\s*\(/);
  });

  it("name a meaning the catalogue has, every one", () => {
    const keys = [...table().matchAll(/"(keys\.[\w.]+)"/g)].map((match) => match[1] ?? "");
    expect(keys.length).toBeGreaterThan(8);
    for (const key of keys) expect(Object.keys(en), key).toContain(key);
  });

  it("never give one key two meanings", () => {
    const spellings = [...table().matchAll(/keys:\s*\[([^\]]*)\]/g)].flatMap((match) =>
      (match[1] ?? "").split(",").map((entry) => entry.trim()).filter((entry) => entry !== ""),
    );
    expect(new Set(spellings).size).toBe(spellings.length);
  });

  it("put every one on the card, and the most used ones in the strip too", () => {
    const rows = [...table().matchAll(/inStrip:\s*(true|false)/g)].map((match) => match[1]);
    expect(rows.length).toBeGreaterThan(6);
    // The strip is the glanceable few. The card is all of them.
    expect(rows.filter((shown) => shown === "true").length).toBeLessThan(rows.length);
    expect(rows.filter((shown) => shown === "false").length).toBeGreaterThan(0);
  });
});

describe("the card", () => {
  it("opens on a key as well as on a button, because the mouse is optional", () => {
    expect(table()).toContain('"?"');
    expect(markup).toContain('id="brief-open"');
  });

  it("closes on Escape without uncovering the screen behind it", () => {
    expect(source).toMatch(/if \(el\.brief\.open\)/);
    expect(markup).toMatch(/<dialog id="brief"/);
  });

  it("says the thing a held key does, which is the question somebody asks", () => {
    expect(en["brief.holding"]).toContain("one cue");
  });
});
