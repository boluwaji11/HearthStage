/**
 * STG-170. The window's markup, split where the workbench begins.
 *
 * One document holds the live surface and the workbench, so a test about what
 * an operator can reach at 10:28 has to say which half it means. Balanced on
 * the div tags, so a section moved into or out of the workbench changes what
 * these tests see.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

export function windowMarkup(): string {
  return readFileSync(join(root, "src/control/index.html"), "utf8");
}

/** The window with the workbench cut out of it. */
export function liveMarkup(): string {
  const markup = windowMarkup();
  const from = markup.indexOf('<div id="workbench"');
  if (from === -1) throw new Error("The workbench is not in the window.");

  const tag = /<(\/?)div\b/g;
  tag.lastIndex = from;
  let depth = 0;
  for (let match = tag.exec(markup); match !== null; match = tag.exec(markup)) {
    depth += match[1] === "/" ? -1 : 1;
    if (depth === 0) {
      return markup.slice(0, from) + markup.slice(markup.indexOf(">", match.index) + 1);
    }
  }
  throw new Error("The workbench does not close.");
}
