/**
 * STG-14, ST1.1. Stage opens and presents without signing in to anything.
 *
 * The acceptance is a clean install on a laptop with the wifi switched off
 * reaching a presentable slide, so these tests walk that path against the real
 * library and count what a person has to do. "Under a minute" is not a stopwatch
 * here: it is how many decisions stand between opening the application and
 * putting words on a wall, and the stopwatch belongs on a real laptop.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileDeck, lookupFrom, presentationPlan, songPlan } from "@hearth/songs";
import { openLibrary, type OpenLibrary } from "@hearth/stage-store";
import { Presentations } from "../src/main/presentations";

const root = fileURLToPath(new URL("..", import.meta.url));

let directory: string;
let opened: OpenLibrary;
let presentations: Presentations;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hearth-first-"));
  opened = openLibrary(join(directory, "library.db"), { backups: false });
  presentations = new Presentations(opened.library, { id: (prefix) => `${prefix}_1` });
});

afterEach(() => {
  opened.close();
  rmSync(directory, { recursive: true, force: true });
});

describe("the first minute", () => {
  it("opens on an empty library with nothing to sign in to", () => {
    const state = presentations.state();
    expect(state.library).toEqual([]);
    expect(state.editing).toBeNull();
    expect(state.device.name).not.toBe("");
  });

  it("reaches a slide on the wall in three presses", () => {
    // New, a title and a line, Present. That is the whole path.
    expect(presentations.apply({ type: "newPresentation" })).toBe(true);
    expect(
      presentations.apply({
        type: "savePresentation",
        presentationId: null,
        title: "Welcome",
        slides: [{ label: null, body: "Welcome to Grace Church" }],
      }),
    ).toBe(true);

    const stored = opened.library.getPresentation("pres_1");
    if (stored === null) throw new Error("nothing stored");
    const deck = compileDeck(presentationPlan(stored), lookupFrom([]), {
      presentations: presentations.lookup(),
    });
    expect(deck.problems).toEqual([]);
    expect(deck.cues[0]?.lines?.[0]).toBe("Welcome to Grace Church");
  });

  it("reaches a hymn on the wall in two presses", () => {
    expect(presentations.apply({ type: "addSamples" })).toBe(true);
    const first = presentations.state().library[0];
    if (first === undefined) throw new Error("nothing in the library");

    const whole = opened.library.get(first.id);
    if (whole === null) throw new Error("not a song");
    const deck = compileDeck(songPlan(whole), lookupFrom([whole]));
    expect(deck.problems).toEqual([]);
    expect(deck.cues.length).toBeGreaterThan(0);
  });

  it("names this machine without being asked", () => {
    presentations.device({ name: "Sound Desk", platform: "darwin" });
    expect(presentations.state().device).toEqual({ name: "Sound Desk", platform: "darwin" });
  });
});

/** Everything a person can see. The main process has no screen. */
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

describe("nothing to sign in to", () => {
  it("has no field that asks who somebody is", () => {
    const asking: string[] = [];
    for (const area of WINDOWS) {
      for (const file of filesUnder(join(root, area), /\.(html|ts)$/)) {
        const source = readFileSync(file, "utf8");
        for (const pattern of [
          /type=["']password["']/,
          /type=["']email["']/,
          /autocomplete=["'](?:username|current-password|new-password|email)["']/,
          /\.type\s*=\s*["'](?:password|email)["']/,
        ]) {
          if (pattern.test(source)) asking.push(file);
        }
      }
    }
    expect(asking).toEqual([]);
  });
});
