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
import { amazingGrace } from "@hearth/songs/fixtures";
import { openLibrary, type OpenLibrary } from "@hearth/stage-store";
import { Presentations } from "../src/main/presentations";
import { Session } from "../src/main/session";

/** What somebody types, one box per slide. */
const NOTICES = [
  { label: "Title", body: "Morning Service" },
  { label: null, body: "Church lunch\nThe 12th, after the service" },
  { label: null, body: "Youth group\nWednesdays, 7pm" },
];

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
    expect(state.editing).toEqual({
      id: null,
      kind: "plain",
      serial: state.editing?.serial,
      title: "",
      slides: [],
      readOnly: false,
    });
  });

  it("saves what was typed, and the library has a row", () => {
    presentations.apply({ type: "newPresentation" });
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      slides: NOTICES,
    });

    const state = presentations.state();
    expect(state.library).toHaveLength(1);
    expect(state.library[0]?.title).toBe("Notices");
    expect(state.library[0]?.count).toBe(3);
    expect(state.editing?.id).toBe("pres_1");
    expect(state.problems).toEqual([]);
  });

  it("loads the saved slides back into the boxes they were typed in", () => {
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      slides: NOTICES,
    });
    expect(presentations.state().editing?.slides).toEqual(NOTICES);
  });

  it("drops a box with nothing in it, because an empty box is not a slide", () => {
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      slides: [...NOTICES, { label: null, body: "   " }],
    });
    expect(presentations.state().library[0]?.count).toBe(3);
    expect(presentations.state().editing?.slides).toHaveLength(3);
  });

  it("keeps a presentation that has a title and no slides yet", () => {
    presentations.apply({ type: "newPresentation" });
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      slides: [],
    });

    const state = presentations.state();
    expect(state.problems).toEqual([]);
    expect(state.library).toHaveLength(1);
    expect(state.library[0]?.count).toBe(0);
    expect(state.editing?.id).toBe("pres_1");
  });

  it("holds the slides in the order the boxes are in", () => {
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      slides: [NOTICES[2], NOTICES[0], NOTICES[1]] as typeof NOTICES,
    });
    expect(
      presentations.state().editing?.slides.map((slide) => slide.body.split("\n")[0]),
    ).toEqual(["Youth group", "Morning Service", "Church lunch"]);
  });

  it("saves over the same row on a second save rather than making another", () => {
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      slides: NOTICES,
    });
    presentations.apply({
      type: "savePresentation",
      presentationId: "pres_1",
      title: "Notices",
      slides: [...NOTICES, { label: null, body: "Giving\nThere is a basket at the back" }],
    });

    const state = presentations.state();
    expect(state.library).toHaveLength(1);
    expect(state.library[0]?.count).toBe(4);
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
      slides: NOTICES,
    });

    const state = presentations.state();
    expect(state.problems.map((problem) => problem.code)).toEqual(["title.missing"]);
    expect(state.library).toEqual([]);
    // The box stays open, so what was typed is still in front of the person.
    expect(state.editing).not.toBeNull();
  });

  it("reports a line holding a line break, which is the R12.4 guard", () => {
    presentations.apply({ type: "newPresentation" });
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      slides: [{ label: null, body: "One\nTwo" }],
    });
    // Split into two lines rather than refused, because splitting the box is
    // this layer's job and the guard is on what reaches the store.
    const stored = presentations.lookup()("pres_1");
    expect(stored?.slides[0]?.lines).toEqual(["One", "Two"]);
    expect(presentations.state().problems).toEqual([]);
  });

  it("clears the problems once the save goes through", () => {
    presentations.apply({ type: "newPresentation" });
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "",
      slides: NOTICES,
    });
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      slides: NOTICES,
    });
    expect(presentations.state().problems).toEqual([]);
    expect(presentations.state().library).toHaveLength(1);
  });

  it("refuses to open a row the library does not have", () => {
    expect(presentations.apply({ type: "openItem", itemId: "nope" })).toBe(false);
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
      slides: NOTICES,
    });
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Sermon outline",
      slides: [{ label: "Point 1", body: "God speaks first" }],
    });
  });

  it("puts that one in the box", () => {
    presentations.apply({ type: "openItem", itemId: "pres_1" });
    const state = presentations.state();
    expect(state.editing?.title).toBe("Notices");
    expect(state.editing?.slides).toEqual(NOTICES);
  });

  it("bumps the serial when a different one is opened, and never on a save", () => {
    presentations.apply({ type: "openItem", itemId: "pres_1" });
    const opened = presentations.state().editing?.serial;

    presentations.apply({
      type: "savePresentation",
      presentationId: "pres_1",
      title: "Notices",
      slides: NOTICES,
    });
    expect(presentations.state().editing?.serial).toBe(opened);

    presentations.apply({ type: "openItem", itemId: "pres_2" });
    expect(presentations.state().editing?.serial).not.toBe(opened);
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
      slides: NOTICES,
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
      slides: [...NOTICES, { label: null, body: "Giving\nThere is a basket at the back" }],
    });
    const plan = presentationPlan(presentations.lookup()("pres_1")!);
    const deck = compileDeck(plan, lookupFrom([]), { presentations: presentations.lookup() });
    expect(deck.cues).toHaveLength(4);
  });
});

describe("one list, songs and slides together", () => {
  beforeEach(() => {
    opened.library.save(amazingGrace);
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      slides: NOTICES,
    });
  });

  it("shows both in the editor's list, each saying which it is", () => {
    const rows = presentations.state().library;
    expect(rows.map((row) => [row.kind, row.title])).toEqual([
      ["song", "Amazing Grace"],
      ["plain", "Notices"],
    ]);
  });

  it("opens a song as the sections it is made of, read only", () => {
    expect(presentations.apply({ type: "openItem", itemId: "song-amazing-grace" })).toBe(true);
    const editing = presentations.state().editing;

    expect(editing?.kind).toBe("song");
    expect(editing?.readOnly).toBe(true);
    expect(editing?.title).toBe("Amazing Grace");
    expect(editing?.slides[0]?.label).toBe("V1");
    expect(editing?.slides[0]?.body.split("\n")[0]).toBe("Amazing grace! how sweet the sound");
  });

  it("refuses to write a song through the slide editor", () => {
    presentations.apply({ type: "openItem", itemId: "song-amazing-grace" });
    const saved = presentations.apply({
      type: "savePresentation",
      presentationId: "song-amazing-grace",
      title: "Amazing Grace",
      slides: NOTICES,
    });

    // The song is untouched, and nothing new turned up in the list.
    expect(saved).toBe(false);
    expect(opened.library.get("song-amazing-grace")?.sections).toHaveLength(
      amazingGrace.sections.length,
    );
    expect(presentations.state().library).toHaveLength(2);
  });

  it("opens a presentation after a song without keeping the song's boxes", () => {
    presentations.apply({ type: "openItem", itemId: "song-amazing-grace" });
    presentations.apply({ type: "openItem", itemId: "pres_1" });

    const editing = presentations.state().editing;
    expect(editing?.kind).toBe("plain");
    expect(editing?.readOnly).toBe(false);
    expect(editing?.slides).toEqual(NOTICES);
  });
});
