/**
 * STG-13, ST17.4, ST21.9. No word written into a window.
 *
 * Externalising copy is the kind of rule that holds for a month and then stops,
 * because the person breaking it is fixing something else and a string is right
 * there. So it is a test. A word typed into a window fails the build, names the
 * file and the line, and the fix is one entry in the catalogue.
 *
 * It covers the windows, which are what a church reads. The main process stores
 * two words that look like copy and are not: an order called "As written" and
 * the `Order 2` a blank name becomes. Both are written into the library and
 * read back as data, so translating them would change a church's records when
 * they changed language.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { en } from "@hearth/stage-i18n";

const root = fileURLToPath(new URL("..", import.meta.url));

/** The windows. The main process is not one. */
const WINDOWS = ["src/control", "src/editor", "src/output", "src/shared"];

function filesUnder(directory: string, suffix: RegExp): string[] {
  const found: string[] = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path, suffix));
    else if (suffix.test(name)) found.push(path);
  }
  return found;
}

interface Offence {
  where: string;
  line: number;
  copy: string;
}

/**
 * A word put on screen from the source rather than from the catalogue.
 *
 * An empty string is allowed, because clearing an element is not copy, and so
 * is a single separator or symbol, because `/` between two numbers is not a
 * sentence anybody translates.
 */
const WRITTEN = [
  /\.textContent\s*(?:\+)?=\s*[^;]*?(["'`])((?:[^"'`\\]|\\.)*)\1/gs,
  /\.(?:title|placeholder)\s*=\s*[^;]*?(["'`])((?:[^"'`\\]|\\.)*)\1/gs,
  /setAttribute\(\s*["'](?:aria-label|title|placeholder)["']\s*,\s*[^)]*?(["'`])((?:[^"'`\\]|\\.)*)\1/gs,
  /createTextNode\(\s*[^)]*?(["'`])((?:[^"'`\\]|\\.)*)\1/gs,
];

/**
 * Takes out the strings that are not copy.
 *
 * A key handed to `t` is the opposite of copy written inline, a string on
 * either side of `===` is a comparison, and a `case` label is a branch. All
 * three sit next to an assignment and none of them is a word anybody reads.
 */
function scrub(source: string): string {
  const LITERAL = `(["'\`])(?:[^"'\\\`]|\\\\.)*\\1`;
  return source
    .replace(new RegExp(`\\b(?:t|plural)\\(\\s*${LITERAL}`, "g"), "t(KEY")
    .replace(new RegExp(`[!=]==?\\s*${LITERAL}`, "g"), "=== KEY")
    .replace(new RegExp(`\\bcase\\s+${LITERAL}`, "g"), "case KEY");
}

function copyIn(source: string): Offence[] {
  const found: Offence[] = [];
  // Scanned whole rather than line by line. A ternary spread over four lines
  // puts the assignment on one and the words on another, which is how
  // "Nothing on the screen" sat in the control window through STG-13.
  const scrubbed = scrub(source);

  for (const pattern of WRITTEN) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(scrubbed)) !== null) {
      const copy = match[2] ?? "";
      if (!/[A-Za-z]{2}/.test(copy)) continue;
      // A catalogue key is `area.thing`: dotted, no spaces. Copy has spaces, or
      // is one word with no dot. A key reaching here is a `t()` whose key was
      // chosen by a condition, which is the opposite of the thing being caught.
      if (/^[a-z][\w]*(?:\.[\w]+)+$/.test(copy)) continue;
      found.push({ where: "", line: scrubbed.slice(0, match.index).split("\n").length, copy });
    }
  }

  return found;
}

describe("copy in a window", () => {
  it("is never written into the source", () => {
    const offences: Offence[] = [];
    for (const area of WINDOWS) {
      for (const file of filesUnder(join(root, area), /\.ts$/)) {
        for (const offence of copyIn(readFileSync(file, "utf8"))) {
          offences.push({ ...offence, where: relative(root, file) });
        }
      }
    }
    expect(offences).toEqual([]);
  });

  it("is never written into the markup", () => {
    const offences: Offence[] = [];

    for (const area of WINDOWS) {
      for (const file of filesUnder(join(root, area), /\.html$/)) {
        const source = readFileSync(file, "utf8")
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/<script[\s\S]*?<\/script>/g, "")
          .replace(/<style[\s\S]*?<\/style>/g, "")
          // The window title is set by the main process, which owns the window.
          .replace(/<title>[\s\S]*?<\/title>/g, "");

        // Tags are blanked out rather than removed, so a tag spread over four
        // lines stays four lines and the line a word is on is the line
        // reported.
        const text = source.replace(/<[^>]*>/g, (tag) => tag.replace(/[^\n]/g, " "));
        text.split("\n").forEach((line, index) => {
          if (/[A-Za-z]{2}/.test(line)) {
            offences.push({ where: relative(root, file), line: index + 1, copy: line.trim() });
          }
        });

        for (const attribute of ["aria-label", "title", "placeholder"]) {
          const written = new RegExp(`\\s${attribute}="([^"]*[A-Za-z]{2}[^"]*)"`, "g");
          for (const match of source.matchAll(written)) {
            offences.push({
              where: relative(root, file),
              line: source.slice(0, match.index).split("\n").length,
              copy: `${attribute}="${match[1]}"`,
            });
          }
        }
      }
    }

    expect(offences).toEqual([]);
  });

  /**
   * A key in markup is a string, so the compiler cannot check it the way it
   * checks `t("...")`. Without this, a renamed key is a blank button that
   * nothing reports.
   */
  /**
   * A `content` rule puts words on a screen as surely as `textContent` does,
   * and a translator reading the catalogue would never find them.
   */
  it("is never written into a stylesheet", () => {
    const offences: Offence[] = [];

    for (const area of WINDOWS) {
      for (const file of filesUnder(join(root, area), /\.css$/)) {
        const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
        for (const match of source.matchAll(/\bcontent:\s*(["'])((?:[^"'\\]|\\.)*)\1/g)) {
          const copy = match[2] ?? "";
          if (!/[A-Za-z]{2}/.test(copy)) continue;
          offences.push({
            where: relative(root, file),
            line: source.slice(0, match.index).split("\n").length,
            copy,
          });
        }
      }
    }

    expect(offences).toEqual([]);
  });

  it("names a key the catalogue has, everywhere in the markup", () => {
    const missing: { where: string; key: string }[] = [];

    for (const area of WINDOWS) {
      for (const file of filesUnder(join(root, area), /\.html$/)) {
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(/\sdata-t(?:-\w+)?="([^"]*)"/g)) {
          const key = match[1] ?? "";
          if (!(key in en)) missing.push({ where: relative(root, file), key });
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
