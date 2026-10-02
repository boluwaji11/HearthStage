/**
 * STG-145. The editor's side of main, without opening a window.
 *
 * What is checked here is the path a person actually walks: New, type, Save,
 * and the state the window gets back. Against the real library on disk, because
 * a fake store would pass a test the real one fails.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileDeck, lookupFrom, presentationPlan } from "@hearth/songs";
import { openLibrary, type OpenLibrary } from "@hearth/stage-store";
import { Presentations } from "../src/main/presentations";
import { Session } from "../src/main/session";

const NOTICES = `[Title]
Morning Service

Church lunch
The 12th, after the service

Youth group
Wednesdays, 7pm`;

let directory: string;
let opened: OpenLibrary;
let presentations: Presentations;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hearth-editor-"));
  opened = openLibrary(join(directory, "library.db"), { backups: false });
  let next = 0;
  presentations = new Presentations(opened.library, { id: () => `pres_${++next}` });
});

afterEach(() => {
  opened.close();
  rmSync(directory, { recursive: true, force: true });
});

describe("the first ten minutes", () => {
  it("starts with nothing, and nothing open", () => {
    const state = presentations.state();
    expect(state.library).toEqual([]);
    expect(state.editing).toBeNull();
    expect(state.problems).toEqual([]);
  });

  it("opens an empty box on New", () => {
    expect(presentations.apply({ type: "newPresentation" })).toBe(true);
    const state = presentations.state();
    expect(state.editing).toEqual({ id: null, title: "", text: "", readOnly: false });
  });

  it("saves what was typed, and the library has a row", () => {
    presentations.apply({ type: "newPresentation" });
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      text: NOTICES,
    });

    const state = presentations.state();
    expect(state.library).toHaveLength(1);
    expect(state.library[0]?.title).toBe("Notices");
    expect(state.library[0]?.slideCount).toBe(3);
    expect(state.editing?.id).toBe("pres_1");
    expect(state.problems).toEqual([]);
  });

  it("loads the saved text back into the same box it was typed in", () => {
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      text: NOTICES,
    });
    expect(presentations.state().editing?.text).toBe(NOTICES);
  });

  it("saves over the same row on a second save rather than making another", () => {
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      text: NOTICES,
    });
    presentations.apply({
      type: "savePresentation",
      presentationId: "pres_1",
      title: "Notices",
      text: `${NOTICES}\n\nGiving\nThere is a basket at the back`,
    });

    const state = presentations.state();
    expect(state.library).toHaveLength(1);
    expect(state.library[0]?.slideCount).toBe(4);
  });

  it("bumps the revision on every change, which is what reloads the box", () => {
    const first = presentations.state().revision;
    presentations.apply({ type: "newPresentation" });
    expect(presentations.state().revision).toBeGreaterThan(first);
  });
});

describe("a save that cannot happen", () => {
  it("reports the missing title and keeps nothing", () => {
    presentations.apply({ type: "newPresentation" });
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "  ",
      text: NOTICES,
    });

    const state = presentations.state();
    expect(state.problems.map((problem) => problem.code)).toEqual(["title.missing"]);
    expect(state.library).toEqual([]);
    // The box stays open, so what was typed is still in front of the person.
    expect(state.editing).not.toBeNull();
  });

  it("reports an empty box", () => {
    presentations.apply({ type: "newPresentation" });
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      text: "",
    });
    expect(presentations.state().problems.map((problem) => problem.code)).toEqual(["slides.none"]);
  });

  it("clears the problems once the save goes through", () => {
    presentations.apply({ type: "newPresentation" });
    presentations.apply({ type: "savePresentation", presentationId: null, title: "", text: NOTICES });
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      text: NOTICES,
    });
    expect(presentations.state().problems).toEqual([]);
    expect(presentations.state().library).toHaveLength(1);
  });

  it("refuses to open one the library does not have", () => {
    expect(presentations.apply({ type: "editPresentation", presentationId: "nope" })).toBe(false);
  });

  it("ignores an intent that belongs to the session", () => {
    expect(presentations.apply({ type: "advance" })).toBe(false);
  });
});

describe("opening one from the library", () => {
  beforeEach(() => {
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      text: NOTICES,
    });
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Sermon outline",
      text: "[Point 1]\nGod speaks first",
    });
  });

  it("puts that one in the box", () => {
    presentations.apply({ type: "editPresentation", presentationId: "pres_1" });
    const state = presentations.state();
    expect(state.editing?.title).toBe("Notices");
    expect(state.editing?.text).toBe(NOTICES);
  });

  it("says which one is on the screen", () => {
    expect(presentations.state("pres_2").presentingId).toBe("pres_2");
  });
});

describe("presenting it", () => {
  beforeEach(() => {
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      text: NOTICES,
    });
  });

  it("reaches the output as the words somebody typed", () => {
    const lookup = presentations.lookup();
    const one = lookup("pres_1");
    expect(one).toBeDefined();

    const plan = presentationPlan(one!);
    const session = new Session(
      compileDeck(plan, lookupFrom([]), { presentations: lookup }),
      plan,
    );

    const first = session.outputState("display:1");
    expect(first.content.kind).toBe("slide");
    expect(first.content.kind === "slide" && first.content.lines).toEqual(["Morning Service"]);
    expect(first.content.kind === "slide" && first.content.label).toBe("Title");

    session.apply({ type: "advance" });
    const second = session.outputState("display:1");
    expect(second.content.kind === "slide" && second.content.lines).toEqual([
      "Church lunch",
      "The 12th, after the service",
    ]);
  });

  it("shows the operator the whole presentation as one group of cues", () => {
    const lookup = presentations.lookup();
    const plan = presentationPlan(lookup("pres_1")!);
    const session = new Session(
      compileDeck(plan, lookupFrom([]), { presentations: lookup }),
      plan,
    );

    const state = session.controlState([]);
    expect(state.groups).toHaveLength(1);
    expect(state.groups[0]?.title).toBe("Notices");
    expect(state.groups[0]?.kind).toBe("slide");
    expect(state.cues.map((cue) => cue.preview)).toEqual([
      "Morning Service",
      "Church lunch",
      "Youth group",
    ]);
  });

  it("picks up a change to the slides without reopening anything", () => {
    presentations.apply({
      type: "savePresentation",
      presentationId: "pres_1",
      title: "Notices",
      text: `${NOTICES}\n\nGiving\nThere is a basket at the back`,
    });
    const plan = presentationPlan(presentations.lookup()("pres_1")!);
    const deck = compileDeck(plan, lookupFrom([]), { presentations: presentations.lookup() });
    expect(deck.cues).toHaveLength(4);
  });
});
