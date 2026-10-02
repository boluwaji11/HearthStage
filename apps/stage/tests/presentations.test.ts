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
import { DEFAULT_THEME } from "../src/main/themes";

/** What somebody types, one box per slide. */
const NOTICES = [
  { label: "Title", body: "Morning Service", note: null },
  { label: null, body: "Church lunch\nThe 12th, after the service", note: null },
  { label: null, body: "Youth group\nWednesdays, 7pm", note: null },
];

let directory: string;
let opened: OpenLibrary;
let presentations: Presentations;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hearth-editor-"));
  opened = openLibrary(join(directory, "library.db"), { backups: false });
  let next = 0;
  presentations = new Presentations(opened.library, { id: (prefix) => `${prefix}_${++next}` });
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
      themeId: null,
      song: null,
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
      slides: [...NOTICES, { label: null, body: "   ", note: null }],
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
      slides: [...NOTICES, { label: null, body: "Giving\nThere is a basket at the back", note: null }],
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
      slides: [{ label: null, body: "One\nTwo", note: null }],
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
      slides: [{ label: "Point 1", body: "God speaks first", note: null }],
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
      slides: [...NOTICES, { label: null, body: "Giving\nThere is a basket at the back", note: null }],
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

  it("opens a song as the sections it is made of", () => {
    expect(presentations.apply({ type: "openItem", itemId: "song-amazing-grace" })).toBe(true);
    const editing = presentations.state().editing;

    expect(editing?.kind).toBe("song");
    // A song of the church's own is theirs to edit (STG-7). A synced one is the
    // platform's and stays read only.
    expect(editing?.readOnly).toBe(false);
    expect(editing?.title).toBe("Amazing Grace");
    expect(editing?.slides[0]?.label).toBe("V1");
    expect(editing?.slides[0]?.body.split("\n")[0]).toBe("Amazing grace! how sweet the sound");
  });

  it("refuses to write a song through the presentation path", () => {
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

describe("a note on a slide", () => {
  beforeEach(() => {
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      slides: [
        { label: "Title", body: "Morning Service", note: "Hold here until the band comes in" },
        { label: null, body: "Church lunch", note: null },
      ],
    });
  });

  it("is stored, and comes back in the box it was typed in", () => {
    const editing = presentations.state().editing;
    expect(editing?.slides[0]?.note).toBe("Hold here until the band comes in");
    expect(editing?.slides[1]?.note).toBeNull();
  });

  it("reaches the operator and never the wall", () => {
    const lookup = presentations.lookup();
    const plan = presentationPlan(lookup("pres_1")!);
    const session = new Session(compileDeck(plan, lookupFrom([]), { presentations: lookup }), plan);

    expect(session.controlState([]).cues[0]?.note).toBe("Hold here until the band comes in");
    expect(session.controlState([]).cues[1]?.note).toBeNull();

    // Nothing about the note is in what the output is handed.
    expect(JSON.stringify(session.outputState("display:1"))).not.toContain("Hold here");
  });

  it("follows both halves of a slide that was split for the screen", () => {
    presentations.apply({
      type: "savePresentation",
      presentationId: "pres_1",
      title: "Notices",
      slides: [{ label: "Title", body: "One\nTwo\nThree\nFour", note: "Read it slowly" }],
    });

    const lookup = presentations.lookup();
    const deck = compileDeck(presentationPlan(lookup("pres_1")!), lookupFrom([]), {
      presentations: lookup,
      limits: { maxLines: 2 },
    });

    expect(deck.cues).toHaveLength(2);
    expect(deck.cues.map((cue) => cue.note)).toEqual(["Read it slowly", "Read it slowly"]);
  });
});

describe("the look, and the words", () => {
  beforeEach(() => {
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      slides: NOTICES,
    });
  });

  it("starts on the service's look", () => {
    expect(presentations.state().editing?.themeId).toBeNull();
  });

  it("offers every built-in look, with a name and a swatch", () => {
    const themes = presentations.state().themes;
    expect(themes.length).toBeGreaterThan(1);
    expect(themes.map((theme) => theme.name)).toContain("Daylight");
    expect(themes.every((theme) => theme.background !== "" && theme.colour !== "")).toBe(true);
  });

  it("changes the look without touching a word", () => {
    const before = JSON.stringify(presentations.lookup()("pres_1")?.slides);

    presentations.apply({
      type: "savePresentation",
      presentationId: "pres_1",
      title: "Notices",
      slides: NOTICES,
      themeId: "hearth-daylight",
    });

    expect(presentations.state().editing?.themeId).toBe("hearth-daylight");
    expect(JSON.stringify(presentations.lookup()("pres_1")?.slides)).toBe(before);
  });

  it("refuses a look this build does not have, and keeps the one it had", () => {
    presentations.apply({
      type: "savePresentation",
      presentationId: "pres_1",
      title: "Notices",
      slides: NOTICES,
      themeId: "hearth-daylight",
    });
    presentations.apply({
      type: "savePresentation",
      presentationId: "pres_1",
      title: "Notices",
      slides: NOTICES,
      themeId: "from-a-later-version",
    });
    expect(presentations.lookup()("pres_1")?.themeId).toBe("hearth-daylight");
  });

  it("leaves the look alone on a save that does not mention it", () => {
    presentations.apply({
      type: "savePresentation",
      presentationId: "pres_1",
      title: "Notices",
      slides: NOTICES,
      themeId: "hearth-strong",
    });
    presentations.apply({
      type: "savePresentation",
      presentationId: "pres_1",
      title: "Notices",
      slides: NOTICES,
    });
    expect(presentations.lookup()("pres_1")?.themeId).toBe("hearth-strong");
  });

  it("paints the output in the look the presentation asks for", () => {
    presentations.apply({
      type: "savePresentation",
      presentationId: "pres_1",
      title: "Notices",
      slides: NOTICES,
      themeId: "hearth-strong",
    });

    const lookup = presentations.lookup();
    const plan = presentationPlan(lookup("pres_1")!);
    const session = new Session(compileDeck(plan, lookupFrom([]), { presentations: lookup }), plan);

    expect(session.outputState("display:1").theme.id).toBe("hearth-strong");
  });

  it("takes the service's look when it asks for none", () => {
    const lookup = presentations.lookup();
    const plan = presentationPlan(lookup("pres_1")!);
    const session = new Session(compileDeck(plan, lookupFrom([]), { presentations: lookup }), plan);

    expect(session.outputState("display:1").theme.id).toBe(DEFAULT_THEME.id);
  });
});

describe("typing a song in, through the editor", () => {
  const FIELDS = {
    author: "John Newton",
    composer: "",
    copyrightLine: "Public Domain",
    ccliNumber: "22025",
    year: "1779",
    isPublicDomain: true,
    defaultKey: "G",
  };

  it("saves it, and the library gains a song", () => {
    expect(
      presentations.apply({
        type: "saveSong",
        songId: null,
        title: "Be Thou My Vision",
        fields: FIELDS,
        sections: [{ label: null, body: "Be Thou my vision, O Lord of my heart" }],
      }),
    ).toBe(true);

    const rows = presentations.state().library;
    expect(rows.map((row) => [row.kind, row.title])).toEqual([["song", "Be Thou My Vision"]]);
    expect(presentations.state().editing?.song?.author).toBe("John Newton");
  });

  it("presents straight away, because it was given an arrangement", () => {
    presentations.apply({
      type: "saveSong",
      songId: null,
      title: "Be Thou My Vision",
      fields: FIELDS,
      sections: [
        { label: null, body: "Be Thou my vision" },
        { label: null, body: "Be Thou my wisdom" },
      ],
    });

    const whole = opened.library.get("song_1");
    expect(whole?.arrangements[0]?.sequence).toEqual(["V1", "V2"]);
  });

  it("reports a song with no title, and keeps nothing", () => {
    presentations.apply({
      type: "saveSong",
      songId: null,
      title: "  ",
      fields: FIELDS,
      sections: [{ label: null, body: "Be Thou my vision" }],
    });

    expect(presentations.state().problems.map((problem) => problem.code)).toContain(
      "title.missing",
    );
    expect(presentations.state().library).toEqual([]);
  });

  it("reports a song with no words, and keeps nothing", () => {
    presentations.apply({
      type: "saveSong",
      songId: null,
      title: "Be Thou My Vision",
      fields: FIELDS,
      sections: [],
    });

    expect(presentations.state().problems.map((problem) => problem.code)).toContain(
      "sections.none",
    );
    expect(presentations.state().library).toEqual([]);
  });

  it("opens a song of the church's own for editing", () => {
    opened.library.save(amazingGrace);
    presentations.apply({ type: "openItem", itemId: "song-amazing-grace" });

    const editing = presentations.state().editing;
    expect(editing?.kind).toBe("song");
    expect(editing?.readOnly).toBe(false);
    expect(editing?.song?.author).toBe("John Newton");
    expect(editing?.slides[0]?.label).toBe("V1");
  });

  it("refuses to write a song over a presentation's id", () => {
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      slides: NOTICES,
    });
    expect(
      presentations.apply({
        type: "saveSong",
        songId: "pres_1",
        title: "Notices",
        fields: FIELDS,
        sections: [{ label: null, body: "One" }],
      }),
    ).toBe(false);
  });
});

describe("going back to the library", () => {
  it("closes what is open", () => {
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      slides: NOTICES,
    });
    expect(presentations.state().editing).not.toBeNull();

    expect(presentations.apply({ type: "closeItem" })).toBe(true);
    expect(presentations.state().editing).toBeNull();
    // The row is still there, which is what the tiles are drawn from.
    expect(presentations.state().library).toHaveLength(1);
  });

  it("does nothing when the library is already what is showing", () => {
    expect(presentations.apply({ type: "closeItem" })).toBe(false);
  });

  it("gives every tile the words to draw and the look to draw them in", () => {
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      slides: NOTICES,
      themeId: "hearth-strong",
    });

    const [row] = presentations.state().library;
    expect(row?.preview).toEqual(["Morning Service"]);
    expect(row?.themeId).toBe("hearth-strong");
  });
});
