/**
 * STG-27, ST12.10. The card a volunteer reads at 10:28.
 *
 * The failure this is written against is not a bug, it is drift: a key that
 * works and is written down nowhere, or written down and no longer working.
 * One table in the window drives both what the keys do and what the card says,
 * so the two cannot disagree. These tests hold that shape in place, because the
 * shape is the whole guarantee.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { en } from "@hearth/stage-i18n";
import { liveMarkup } from "./markup";

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

  it("put every one on the card, with nothing left along the bottom", () => {
    const rows = [...table().matchAll(/label:\s*"keys\./g)];
    expect(rows.length).toBeGreaterThan(6);
    // The card is the one place the keys are written down. A strip along the
    // bottom was a second place, and a second place is a place to drift from.
    expect(markup).not.toContain('id="keys"');
  });
});

describe("the card", () => {
  it("opens on a key as well as on a button, because the mouse is optional", () => {
    expect(table()).toContain('"?"');
    expect(markup).toContain('id="brief-open"');
  });

  it("closes on Escape without uncovering the screen behind it", () => {
    expect(source).toMatch(/el\.brief\.open \|\| el\.countdown\.open/);
    expect(markup).toMatch(/<dialog id="brief"/);
  });

  it("is one of three cards, all opened from the same corner", () => {
    // The live surface's own cards. The workbench holds its own, and since
    // STG-170 they share a document, so this counts the ones outside it.
    const live = liveMarkup();
    expect([...live.matchAll(/<dialog/g)]).toHaveLength(3);
    const footer = live.slice(live.indexOf("<footer>"), live.indexOf("</footer>"));
    for (const id of ["brief-open", "countdown-open", "call-open"]) {
      expect(footer, id).toContain(`id="${id}"`);
    }
  });

  it("closes on an x in its corner, the same as the other card", () => {
    for (const id of ["brief-close", "countdown-close"]) {
      const at = markup.indexOf(`id="${id}"`);
      expect(at, id).toBeGreaterThan(-1);
      const button = markup.slice(markup.lastIndexOf("<button", at), markup.indexOf(">", at) + 1);
      // Drawn, and carrying its name, because an icon with nothing behind it is
      // refused (docs/design-system.md section 12).
      expect(button, id).toContain('class="icon"');
      expect(button, id).toContain('data-t-label="card.close"');
    }
  });
});
