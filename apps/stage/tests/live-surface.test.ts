/**
 * STG-25, ST12.3, ST2.15. What the live surface cannot do.
 *
 * The design case is 10:28 on a Sunday with a sixteen year old operating and a
 * room filling up. Everything they can reach has to be safe to press by
 * accident, so the library, the editing, the importing and the theme picking
 * live in the workbench, which is a page that covers the live surface rather
 * than anything reachable beside it (STG-170), and nothing on the live surface
 * can delete anything.
 *
 * Enforced by a test rather than by discipline, because the person who puts a
 * library list on this surface will have a good reason and will be in a hurry.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { liveMarkup, windowMarkup } from "./markup";

const root = fileURLToPath(new URL("..", import.meta.url));

function controlSource(): string {
  return readFileSync(join(root, "src/control/control.ts"), "utf8") + liveMarkup();
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
  // A clock over the top of whatever is open, and taking it away again
  // (STG-26). It writes nothing and the slide underneath is untouched, the
  // same as the covers.
  "startCountdown",
  "addCountdown",
  "stopCountdown",
  // The two ways in (STG-46). Both open the other window and write nothing.
  "showPlans",
  "showLibrary",
  "showSettings",
  // Starting the planned service from the landing page (STG-48, ST12.5). The
  // landing page is only on screen when nothing is running, so this cannot
  // take a service off the wall.
  "presentSetList",
  "newPlanSlide",
  "saveToLibrary",
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
    const markup = liveMarkup();
    for (const pattern of [/<select/i, /type=["']file["']/i, /id=["']tiles["']/i]) {
      expect(markup, String(pattern)).not.toMatch(pattern);
    }
  });

  /**
   * STG-170. The workbench is one window with the live surface, so what keeps
   * the library out of an operator's reach is that the two are never on screen
   * together. That is one rule in one stylesheet, and this is it.
   */
  it("is put away whole while the workbench is open", () => {
    const css = readFileSync(join(root, "src/control/control.css"), "utf8");
    const rule = css.slice(css.indexOf('body[data-workbench="open"]'));
    expect(rule, "the rule is in control.css").not.toEqual("");
    for (const part of ["#start", "#running", "footer"]) {
      expect(rule.slice(0, rule.indexOf("}")), part).toContain(part);
    }
    expect(rule.slice(0, rule.indexOf("}") + 1)).toContain("display: none !important");

    // And the editor half is what sets it, on every paint.
    const source = readFileSync(join(root, "src/editor/editor.ts"), "utf8");
    expect(source).toMatch(/dataset\["workbench"\]/);
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

    const markup = windowMarkup();
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

/**
 * STG-48, ST12.5. The one keypress.
 *
 * The plan on the landing page starts a service, which is the one thing on that
 * page that changes what a room looks at. It is safe because the page is gone
 * the moment something is running, and this holds that in place.
 */
describe("the plan on the landing page", () => {
  it("is on the landing page and nowhere else", () => {
    const markup = liveMarkup();
    const start = markup.slice(markup.indexOf('id="start"'), markup.indexOf("</section>"));
    expect(start).toContain('id="start-next"');
    expect([...markup.matchAll(/id="start-next"/g)]).toHaveLength(1);
  });

  it("takes the focus once per plan rather than on every paint", () => {
    const source = readFileSync(join(root, "src/control/control.ts"), "utf8");
    // The state goes down behind every keypress, so a focus call that ran on
    // each one would make the rest of the window unreachable.
    expect([...source.matchAll(/startNext\.focus\(\)/g)]).toHaveLength(1);
    expect(source).toContain("focusedOn === plan.id");
    // And only while the landing page is the thing on screen, so somebody
    // typing a hymn in the workbench keeps their cursor.
    expect(source).toContain("el.startNext.offsetParent !== null");
    // Asked on the next frame, because the workbench is the other half of this
    // window and the layout before it paints is the one from the page before.
    expect(source).toMatch(/requestAnimationFrame\(\(\) => \{[\s\S]*?startNext\.focus/);
  });
});
