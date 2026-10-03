/**
 * STG-25, ST12.3, ST2.15. What the live surface cannot do.
 *
 * The design case is 10:28 on a Sunday with a sixteen year old operating and a
 * room filling up. Everything they can reach has to be safe to press by
 * accident, so the library, the editing, the importing and the theme picking
 * live in the other window and nothing on this one can delete anything.
 *
 * Enforced by a test rather than by discipline, because the person who puts a
 * library list on this surface will have a good reason and will be in a hurry.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function controlSource(): string {
  return (
    readFileSync(join(root, "src/control/control.ts"), "utf8") +
    readFileSync(join(root, "src/control/index.html"), "utf8")
  );
}

/**
 * Everything the live surface is allowed to ask for.
 *
 * Moving through a service, covering the screen, changing the order of this run
 * (which writes nothing), and the three doors out: the editor, the library and
 * the sample. A door is not a destructive act, and the window it opens is where
 * the library lives.
 */
const ALLOWED = new Set([
  "advance",
  "reverse",
  "goTo",
  "goToCue",
  "setBlank",
  "toggleBlank",
  "reload",
  "runChange",
  "resetRun",
  "closeService",
  "openEditor",
  "makeSlide",
  "openLibrary",
  "openSample",
  // A clock over the top of whatever is open, and taking it away again
  // (STG-26). It writes nothing and the slide underneath is untouched, the
  // same as the covers.
  "startCountdown",
  "addCountdown",
  "stopCountdown",
]);

/** Anything that writes, removes or restyles. None of it belongs here. */
const REFUSED = [
  "savePresentation",
  "saveSong",
  "newPresentation",
  "openItem",
  "closeItem",
  "addSamples",
  "renameDevice",
  "chooseLogo",
  "removeLogo",
];

describe("the live surface", () => {
  it("asks for nothing outside what running a service needs", () => {
    const asked = new Set(
      [...controlSource().matchAll(/type:\s*"([a-zA-Z]+)"/g)].map((match) => match[1] ?? ""),
    );
    const extra = [...asked].filter((intent) => !ALLOWED.has(intent));
    expect(extra).toEqual([]);
  });

  it("cannot write, remove or restyle anything", () => {
    const source = controlSource();
    const found = REFUSED.filter((intent) => source.includes(`"${intent}"`));
    expect(found).toEqual([]);
  });

  it("holds no library, no importer and no theme picker", () => {
    const markup = readFileSync(join(root, "src/control/index.html"), "utf8");
    for (const pattern of [/<select/i, /type=["']file["']/i, /id=["']tiles["']/i]) {
      expect(markup, String(pattern)).not.toMatch(pattern);
    }
  });

  it("keeps the run changes out of the set list, which is what makes them safe", () => {
    // The order buttons are the one thing on this surface that changes
    // anything. `running.ts` is a layer over the compiled deck and touches no
    // store, which is why they are allowed here at all.
    const source = readFileSync(join(root, "src/main/running.ts"), "utf8");
    expect(source).not.toMatch(/stage-store|library|save/i);
  });
});

/**
 * ST12.3 again, from the other side: the one act in the editor that changes
 * what a room is looking at asks first, and asks in the application's own
 * voice.
 */
describe("putting something else on the screen", () => {
  it("asks before it replaces a service that is running", () => {
    const source = readFileSync(join(root, "src/editor/editor.ts"), "utf8");
    expect(source).toContain("present.replace.title");
    // Named by the service it is about to take down. A confirmation that
    // cannot say what it is replacing is not one.
    expect(source).toContain("present.replace.detail");
    expect(source).toMatch(/showModal\(\)/);
  });

  it("asks in the application's own dialog rather than the operating system's", () => {
    for (const file of ["src/main/index.ts", "src/editor/editor.ts"]) {
      expect(readFileSync(join(root, file), "utf8"), file).not.toMatch(/showMessageBox/);
    }
  });

  it("never stacks two dialogs, because there is one way to open one", () => {
    const source = readFileSync(join(root, "src/editor/editor.ts"), "utf8");
    // One call to showModal in the whole window, inside a helper that closes
    // whatever was open. Modal stacking is refused outright, and the way to
    // refuse it is to leave one door rather than to remember not to use two.
    expect([...source.matchAll(/\.showModal\(\)/g)]).toHaveLength(1);
    expect(source).toContain("function showOnly(");

    const markup = readFileSync(join(root, "src/editor/index.html"), "utf8");
    // Native dialog elements, which close on Escape and trap focus without a
    // line of script.
    expect(markup).toMatch(/<dialog id="ask"/);
    expect(markup).toMatch(/<dialog id="pick"/);
  });
});

/**
 * A dialog that opens in the top left corner is a dialog nobody trusts. A
 * modal `<dialog>` centres itself on `margin: auto`, and a reset that zeroes
 * every margin takes that away without anything failing.
 */
describe("where the dialog opens", () => {
  it("is the middle of the window", () => {
    const styles = readFileSync(join(root, "src/editor/editor.css"), "utf8");
    const rule = /\.ask\s*\{[^}]*\}/.exec(styles)?.[0] ?? "";
    expect(rule).toMatch(/margin:\s*auto/);
  });
});
