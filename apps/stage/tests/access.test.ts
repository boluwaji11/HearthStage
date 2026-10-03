/**
 * STG-30, ST20.1, ST20.2. The parts of the bar that a file can hold.
 *
 * The audit itself drives a real window, because contrast is a colour over a
 * colour after the tokens resolve and a name is whatever `fillText` put there.
 * It needs a display, so it runs in CI rather than here. These are the rules
 * that can be checked from the source in a second, so a change that breaks one
 * fails before anybody waits for Electron to start.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { en } from "@hearth/stage-i18n";
import { windowMarkup } from "./markup";

const root = fileURLToPath(new URL("..", import.meta.url));
const STYLESHEETS = ["src/control/control.css", "src/editor/editor.css", "src/output/output.css"];

describe("the focus ring", () => {
  it("is never styled away", () => {
    for (const file of STYLESHEETS) {
      const css = readFileSync(join(root, file), "utf8");
      const removed = [...css.matchAll(/:focus(-visible)?[^{]*\{[^}]*outline:\s*(none|0)\b/g)];
      expect(removed.map((match) => match[0]), file).toEqual([]);
    }
  });

  it("is declared once, for the whole window", () => {
    // The two stylesheets share a document since STG-170, so the ring is set in
    // control.css and the workbench inherits it. Declared in both, the second
    // one would be the one that wins and nobody would know which.
    const control = readFileSync(join(root, "src/control/control.css"), "utf8");
    expect(control).toMatch(/:focus-visible\s*\{[^}]*outline:\s*\d/);
    const workbench = readFileSync(join(root, "src/editor/editor.css"), "utf8");
    expect(workbench).not.toMatch(/^:focus-visible/m);
  });
});

/** `add-samples` is reached as `addSamples` in the window's element map. */
function camel(id: string): string {
  return id.replace(/-([a-z])/g, (unused, letter: string) => letter.toUpperCase());
}

describe("every control", () => {
  const markup = windowMarkup();

  it("is a real control, so the keyboard reaches it", () => {
    // A div somebody hung a click on is reachable by mouse and by nothing
    // else. Everything that does something here is a button, a field or a
    // link, which the browser makes focusable without being asked.
    const handlers = [...markup.matchAll(/<(div|span|li|p)\b[^>]*\bonclick/gi)];
    expect(handlers.map((match) => match[0])).toEqual([]);
  });

  it("carries a name, from the markup or from the window", () => {
    // An icon-only button is an `IconButton` in the design system and the label
    // is required there. This is the plain-DOM version of that rule. A button
    // whose words are a count cannot name itself in the markup, so it names
    // itself in the script, and this says which buttons those are.
    const script =
      readFileSync(join(root, "src/control/control.ts"), "utf8") +
      readFileSync(join(root, "src/editor/editor.ts"), "utf8");

    const unnamed = [...markup.matchAll(/<button\b([^>]*)>\s*<\/button>/g)]
      .map((match) => match[1] ?? "")
      .filter((attributes) => !/data-t(-label)?=/.test(attributes))
      .map((attributes) => /id="([^"]+)"/.exec(attributes)?.[1] ?? "")
      .filter((id) => {
        const named = new RegExp(`${camel(id)}\\.textContent\\s*=`);
        return !named.test(script);
      });
    expect(unnamed).toEqual([]);
  });

  it("names itself out of the catalogue, so the name is a word somebody wrote", () => {
    const keys = [...markup.matchAll(/data-t(?:-label)?="([^"]+)"/g)].map((match) => match[1] ?? "");
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) expect(en, key).toHaveProperty(key);
  });
});

describe("the audit", () => {
  const source = readFileSync(join(root, "tests/audit.mjs"), "utf8");

  it("holds WCAG 2.2 AA and nothing weaker", () => {
    expect(source).toContain('"wcag2a"');
    expect(source).toContain('"wcag2aa"');
    expect(source).toContain('"wcag22aa"');
  });

  it("leaves best-practice out, because it is advice rather than the standard", () => {
    const tags = /const TAGS = \[([^\]]+)\]/.exec(source)?.[1] ?? "";
    expect(tags).not.toContain("best-practice");
    expect(tags).not.toContain("experimental");
  });

  it("covers the surface a volunteer meets, running and not", () => {
    for (const state of ["the landing page", "a service running", "the shortcuts card"]) {
      expect(source, state).toContain(state);
    }
  });

  it("runs in CI", () => {
    const workflow = readFileSync(join(root, "../../.github/workflows/ci.yml"), "utf8");
    expect(workflow).toContain("a11y");
    // Electron needs a display, and a step that cannot start passes quietly.
    expect(workflow).toContain("xvfb-run");
  });
});
