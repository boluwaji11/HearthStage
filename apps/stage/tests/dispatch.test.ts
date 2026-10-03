/**
 * The intent reaching the thing that handles it.
 *
 * Main's dispatch forwards a named set of intents to `presentations`, and
 * everything else falls through to `session`. An intent that `presentations`
 * handles but main does not name therefore reaches the session, which does not
 * know it, and is dropped without a word: the button is wired, the state is
 * right, and nothing happens.
 *
 * That has been the failure three times now, in STG-170, STG-53 and STG-150,
 * and it is invisible to every other test here, because each half is correct on
 * its own. It is only wrong where they meet, so this is the test that stands
 * there.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function source(file: string): string {
  return readFileSync(join(root, file), "utf8");
}

/** The intents a file's switch statements name. */
function handled(file: string): Set<string> {
  return new Set([...source(file).matchAll(/case "([a-zA-Z]+)":/g)].map((match) => match[1] ?? ""));
}

/** Every intent in the wire contract, read off the union. */
function declared(): Set<string> {
  const protocol = readFileSync(
    join(root, "../../packages/stage-protocol/src/index.ts"),
    "utf8",
  );
  const union = protocol.slice(protocol.indexOf("export type Intent ="));
  const end = union.indexOf("\n\n/**", union.indexOf("|"));
  return new Set(
    [...union.slice(0, end).matchAll(/\{\s*type:\s*"([a-zA-Z]+)"/g)].map((match) => match[1] ?? ""),
  );
}

describe("every intent", () => {
  const main = handled("src/main/index.ts");
  const editor = handled("src/main/presentations.ts");
  const live = handled("src/main/session.ts");

  it("is declared in the wire contract and nowhere else", () => {
    expect(declared().size).toBeGreaterThan(30);
  });

  it("that the editor half handles is named in main's dispatch", () => {
    // Otherwise it falls through to the session, which does not know it, and
    // the press does nothing at all.
    const missing = [...editor].filter((intent) => declared().has(intent) && !main.has(intent));
    expect(missing).toEqual([]);
  });

  it("reaches something that handles it", () => {
    const anywhere = new Set([...main, ...editor, ...live]);
    const orphans = [...declared()].filter((intent) => !anywhere.has(intent));
    expect(orphans).toEqual([]);
  });

  it("the live surface sends is one something handles", () => {
    const asked = new Set(
      [...source("src/control/control.ts").matchAll(/type:\s*"([a-zA-Z]+)"/g)].map(
        (match) => match[1] ?? "",
      ),
    );
    const anywhere = new Set([...main, ...editor, ...live]);
    expect([...asked].filter((intent) => !anywhere.has(intent))).toEqual([]);
  });

  it("the workbench sends is one something handles", () => {
    const asked = new Set(
      [...source("src/editor/editor.ts").matchAll(/type:\s*"([a-zA-Z]+)"/g)].map(
        (match) => match[1] ?? "",
      ),
    );
    const anywhere = new Set([...main, ...editor, ...live]);
    expect([...asked].filter((intent) => !anywhere.has(intent))).toEqual([]);
  });
});
