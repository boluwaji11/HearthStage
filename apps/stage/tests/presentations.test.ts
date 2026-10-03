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
import {
  BUNDLED_HYMN_COUNT,
  compileDeck,
  lookupFrom,
  presentationPlan,
  setListPlan,
  songPlan,
} from "@hearth/songs";
import { amazingGrace, holyHolyHoly } from "@hearth/songs/fixtures";
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
      orders: [],
      reference: null,
      serial: state.editing?.serial,
      title: "",
      slides: [],
      themeId: null,
      song: null,
      readOnly: false,
      inLibrary: true,
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

  /**
   * STG-9, ST2.3. A second order, through the whole path.
   *
   * Written by the editor's intent, stored, and read back as the window shows
   * it, because the three steps have been wrong separately before.
   */
  it("keeps a second order, and presents the one marked default", () => {
    opened.library.save(amazingGrace);
    presentations.apply({ type: "openItem", itemId: "song-amazing-grace" });
    const open = presentations.state().editing;
    if (open === null) throw new Error("nothing open");

    expect(open.orders.map((order) => order.isDefault)).toContain(true);

    presentations.apply({
      type: "saveSong",
      songId: "song-amazing-grace",
      title: open.title,
      fields: open.song ?? FIELDS,
      sections: open.slides,
      orders: [
        ...open.orders.map((order) => ({ ...order, isDefault: false })),
        { name: "Short", sequence: ["V1", "V3"], isDefault: true },
      ],
    });

    expect(presentations.state().problems).toEqual([]);
    const stored = opened.library.get("song-amazing-grace");
    if (stored === null) throw new Error("not stored");
    const short = stored.arrangements.find((one) => one.name === "Short");
    expect(short?.sequence).toEqual(["V1", "V3"]);
    expect(stored.arrangements.filter((one) => one.isDefault)).toEqual([short]);

    // The window shows the default first, which is the one that presents.
    presentations.apply({ type: "openItem", itemId: "song-amazing-grace" });
    expect(presentations.state().editing?.orders[0]?.name).toBe("Short");
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

/**
 * STG-10, ST1.2. The hymns Stage carries, offered rather than installed.
 *
 * The point of the story is the thing that does not happen: a church opening
 * Stage for the first time gets an empty library and a button, so what is in it
 * is what they put in it.
 */
describe("the hymns on offer", () => {
  it("writes nothing into a library nobody has asked about", () => {
    const state = presentations.state();
    expect(state.library).toEqual([]);
    expect(state.samples).toBeGreaterThan(100);
  });

  it("puts them in when somebody presses it", () => {
    expect(presentations.apply({ type: "addSamples" })).toBe(true);
    const state = presentations.state();
    expect(state.library.length).toBe(BUNDLED_HYMN_COUNT);
    expect(state.library.every((row) => row.kind === "song")).toBe(true);
    expect(state.samples).toBe(0);
  });

  it("does nothing the second time, so a church cannot end up with two of each", () => {
    presentations.apply({ type: "addSamples" });
    expect(presentations.apply({ type: "addSamples" })).toBe(false);
    expect(presentations.state().library.length).toBe(BUNDLED_HYMN_COUNT);
  });

  it("opens one, and it presents", () => {
    presentations.apply({ type: "addSamples" });
    const first = presentations.state().library[0];
    if (first === undefined) throw new Error("nothing in the library");

    presentations.apply({ type: "openItem", itemId: first.id });
    const editing = presentations.state().editing;
    expect(editing?.kind).toBe("song");
    expect(editing?.slides.length).toBeGreaterThan(0);
    expect(editing?.orders[0]?.sequence.length).toBeGreaterThan(0);

    const whole = opened.library.get(first.id);
    if (whole === null) throw new Error("not stored");
    const deck = compileDeck(songPlan(whole), lookupFrom([whole]));
    expect(deck.problems).toEqual([]);
    expect(deck.cues.length).toBeGreaterThan(0);
  });

  it("leaves a church that has its own songs alone", () => {
    opened.library.save(amazingGrace);
    expect(presentations.state().library.map((row) => row.title)).toEqual(["Amazing Grace"]);
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

/**
 * STG-26, ST5.10, ST7.3. A reading, with no service open.
 *
 * The bundled translations arrive with ST7.1. Until they do, a church puts a
 * passage up by typing it and saying where it is from, and the thing that makes
 * it a reading rather than a sheet of slides is that one field.
 */
describe("a reading", () => {
  const PSALM = [
    { label: null, body: "The first slide of the passage", note: null },
    { label: null, body: "The second slide of the passage", note: null },
  ];

  function readingSaved(reference: string | null) {
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Psalm 23",
      slides: PSALM,
      reference,
    });
    const stored = opened.library.getPresentation("pres_1");
    if (stored === null) throw new Error("nothing stored");
    return stored;
  }

  it("keeps where it is from", () => {
    expect(readingSaved("Psalm 23:1-6").reference).toBe("Psalm 23:1-6");
  });

  it("is presented as a reading, with the reference on every slide", () => {
    const stored = readingSaved("Psalm 23:1-6");
    const deck = compileDeck(presentationPlan(stored), lookupFrom([]), {
      presentations: presentations.lookup(),
    });

    expect(deck.problems).toEqual([]);
    expect(deck.cues).toHaveLength(2);
    for (const cue of deck.cues) {
      expect(cue.kind).toBe("scripture");
      expect(cue.reference).toBe("Psalm 23:1-6");
    }
  });

  it("is a sheet of slides where nobody said where it is from", () => {
    const stored = readingSaved(null);
    expect(stored.reference).toBeNull();
    const deck = compileDeck(presentationPlan(stored), lookupFrom([]), {
      presentations: presentations.lookup(),
    });
    expect(deck.cues.every((cue) => cue.kind === "slide")).toBe(true);
  });

  it("treats a box somebody left blank as no reference at all", () => {
    expect(readingSaved("   ").reference).toBeNull();
  });

  it("keeps the reference through a save that says nothing about it", () => {
    readingSaved("Psalm 23:1-6");
    presentations.apply({
      type: "savePresentation",
      presentationId: "pres_1",
      title: "Psalm 23",
      slides: PSALM,
    });
    expect(opened.library.getPresentation("pres_1")?.reference).toBe("Psalm 23:1-6");
  });
});

/**
 * STG-46, ST2.8. Building a service, through the path a person walks.
 *
 * New, name it, add two things from the library and a heading, present it. The
 * part worth defending is that the order points at the library, so the service
 * a church built on Thursday shows Thursday's words on Sunday.
 */
describe("building a service", () => {
  beforeEach(() => {
    opened.library.save(amazingGrace);
  });

  function built() {
    presentations.apply({ type: "newSetList" });
    presentations.apply({
      type: "saveSetList",
      setListId: null,
      title: "Morning Service",
      date: "2026-10-04",
      entries: [
        { kind: "marker", itemId: null, title: "Welcome" },
        { kind: "item", itemId: "song-amazing-grace", title: "Amazing Grace" },
        { kind: "marker", itemId: null, title: "Sermon" },
      ],
    });
    return presentations.state();
  }

  it("opens an empty one on New, dated today", () => {
    expect(presentations.apply({ type: "newSetList" })).toBe(true);
    const open = presentations.state().editingSet;
    expect(open?.entries).toEqual([]);
    expect(open?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("stores it, and the list of services has a row", () => {
    const state = built();
    expect(state.setLists.map((row) => [row.title, row.entries])).toEqual([["Morning Service", 3]]);
    expect(state.problems).toEqual([]);
  });

  it("reads back in the order it was built", () => {
    built();
    const id = presentations.state().setLists[0]?.id ?? "";
    presentations.apply({ type: "openSetList", setListId: id });
    expect(presentations.state().editingSet?.entries.map((one) => one.title)).toEqual([
      "Welcome",
      "Amazing Grace",
      "Sermon",
    ]);
  });

  it("compiles to a deck of the things it names", () => {
    built();
    const id = presentations.state().setLists[0]?.id ?? "";
    const list = opened.library.getSetList(id);
    if (list === null) throw new Error("not stored");

    const plan = setListPlan(list, (itemId) => opened.library.kindOf(itemId));
    const deck = compileDeck(plan, lookupFrom([amazingGrace]), {
      presentations: presentations.lookup(),
    });

    expect(deck.problems).toEqual([]);
    expect(deck.groups.map((group) => group.title)).toEqual([
      "Welcome",
      "Amazing Grace",
      "Sermon",
    ]);
  });

  it("shows the library's words rather than a copy taken on Thursday", () => {
    built();
    // The hymn is corrected after the service was built.
    const fixed = {
      ...amazingGrace,
      sections: amazingGrace.sections.map((section, index) =>
        index === 0 ? { ...section, lines: ["A line somebody corrected"] } : section,
      ),
    };
    opened.library.save(fixed);

    const id = presentations.state().setLists[0]?.id ?? "";
    const list = opened.library.getSetList(id);
    if (list === null) throw new Error("not stored");
    const deck = compileDeck(
      setListPlan(list, (itemId) => opened.library.kindOf(itemId)),
      lookupFrom([fixed]),
    );
    expect(deck.cues.some((cue) => cue.lines?.[0] === "A line somebody corrected")).toBe(true);
  });

  it("reports a service with no name, and keeps nothing", () => {
    presentations.apply({ type: "newSetList" });
    presentations.apply({
      type: "saveSetList",
      setListId: null,
      title: "  ",
      date: "2026-10-04",
      entries: [],
    });
    expect(presentations.state().problems.map((problem) => problem.code)).toContain("title.missing");
    expect(presentations.state().setLists).toEqual([]);
  });

  it("has one thing open at a time, so a service and a hymn never share the window", () => {
    presentations.apply({ type: "openItem", itemId: "song-amazing-grace" });
    expect(presentations.state().editing).not.toBeNull();

    presentations.apply({ type: "newSetList" });
    expect(presentations.state().editing).toBeNull();
    expect(presentations.state().editingSet).not.toBeNull();
  });

  it("uses last week's again, and leaves last week's alone", () => {
    built();
    const last = presentations.state().setLists[0]?.id ?? "";

    expect(presentations.apply({ type: "duplicateSetList", setListId: last })).toBe(true);
    const open = presentations.state().editingSet;
    // Opened, because somebody who pressed it is about to change two things.
    expect(open?.id).not.toBe(last);
    expect(open?.entries.map((one) => one.title)).toEqual(["Welcome", "Amazing Grace", "Sermon"]);
    expect(open?.date).toBe("2026-10-11");

    const rows = presentations.state().setLists;
    expect(rows).toHaveLength(2);
    expect(opened.library.getSetList(last)?.date).toBe("2026-10-04");
  });

  it("closes back to the list", () => {
    built();
    expect(presentations.apply({ type: "closeSetList" })).toBe(true);
    expect(presentations.state().editingSet).toBeNull();
  });
});

/**
 * STG-169. Where a slide lives.
 *
 * A church types a term of one-off notices. None of them belong on the shelf
 * somebody browses looking for a hymn, and the one that does belong there gets
 * put there on purpose.
 */
describe("the shelf", () => {
  /** Opens a plan and returns its id, which exists only after the first save. */
  function planOpen(): string {
    expect(presentations.apply({ type: "newSetList" })).toBe(true);
    expect(
      presentations.apply({
        type: "saveSetList",
        setListId: null,
        title: "Morning Service",
        date: "2026-10-04",
        entries: [],
      }),
    ).toBe(true);
    const id = presentations.state().editingSet?.id;
    expect(id).toBeTypeOf("string");
    return id as string;
  }

  function typeSlide(title: string): void {
    expect(
      presentations.apply({
        type: "savePresentation",
        presentationId: null,
        title,
        slides: [{ label: null, body: "Church lunch", note: null }],
      }),
    ).toBe(true);
  }

  it("keeps a slide typed inside a plan off the library", () => {
    planOpen();
    expect(presentations.apply({ type: "newPlanSlide" })).toBe(true);
    expect(presentations.state().editing?.inLibrary).toBe(false);

    typeSlide("Notices");
    expect(presentations.state().library).toEqual([]);
  });

  it("puts that slide in the plan it was typed inside", () => {
    const planId = planOpen();
    presentations.apply({ type: "newPlanSlide" });
    typeSlide("Notices");

    const list = opened.library.getSetList(planId);
    expect(list?.entries.map((entry) => entry.title)).toEqual(["Notices"]);
    const itemId = list?.entries[0]?.itemId ?? "";
    expect(opened.library.getPresentation(itemId)?.inLibrary).toBe(false);
  });

  it("puts it on the shelf when somebody says to", () => {
    planOpen();
    presentations.apply({ type: "newPlanSlide" });
    typeSlide("Notices");

    expect(presentations.apply({ type: "saveToLibrary" })).toBe(true);
    expect(presentations.state().editing?.inLibrary).toBe(true);
    expect(presentations.state().library.map((row) => row.title)).toEqual(["Notices"]);
  });

  it("leaves a slide typed in the library on the shelf", () => {
    expect(presentations.apply({ type: "newPresentation" })).toBe(true);
    typeSlide("Welcome");
    expect(presentations.state().library.map((row) => row.title)).toEqual(["Welcome"]);
  });

  it("refuses a plan slide when no plan is open", () => {
    expect(presentations.apply({ type: "newPlanSlide" })).toBe(false);
  });

  it("still presents a slide that is off the shelf", () => {
    const planId = planOpen();
    presentations.apply({ type: "newPlanSlide" });
    typeSlide("Notices");

    const list = opened.library.getSetList(planId);
    const deck = compileDeck(
      setListPlan(list!, (id) => opened.library.kindOf(id)),
      lookupFrom([]),
      { presentations: presentations.lookup() },
    );
    expect(deck.problems).toEqual([]);
    expect(deck.cues.some((cue) => cue.lines?.[0] === "Church lunch")).toBe(true);
  });
});

/**
 * STG-169, STG-170. The plan is open behind the slide being typed, so the window
 * is holding a copy of it from before the slide existed.
 */
describe("the plan behind the slide", () => {
  it("hands the window a new copy once the slide is in it", () => {
    presentations.apply({ type: "newSetList" });
    presentations.apply({
      type: "saveSetList",
      setListId: null,
      title: "Morning Service",
      date: "2026-10-04",
      entries: [],
    });
    const before = presentations.state().editingSet?.serial ?? -1;

    presentations.apply({ type: "newPlanSlide" });
    presentations.apply({
      type: "savePresentation",
      presentationId: null,
      title: "Notices",
      slides: [{ label: null, body: "Church lunch", note: null }],
    });

    const after = presentations.state().editingSet;
    expect(after?.serial).toBeGreaterThan(before);
    expect(after?.entries.map((entry) => entry.title)).toEqual(["Notices"]);
  });
});

/**
 * STG-53, ST2.11. The period the report covers.
 *
 * The screen somebody visits once a year, so it opens on the answer rather than
 * on two empty date boxes.
 */
describe("the CCLI report", () => {
  function sang(date: string, setListId: string): void {
    opened.library.logUsage({
      songId: amazingGrace.song.id,
      title: amazingGrace.song.title,
      ccliNumber: "22025",
      serviceDate: date,
      setListId,
      shownAt: `${date}T10:00:00Z`,
    });
  }

  beforeEach(() => {
    opened.library.save(amazingGrace);
  });

  it("opens on the last six months", () => {
    const { from, to } = presentations.state().usage;
    expect(from < to).toBe(true);
    const months = (Date.parse(to) - Date.parse(from)) / (1000 * 60 * 60 * 24);
    expect(months).toBeGreaterThan(175);
    expect(months).toBeLessThan(190);
  });

  it("counts what the period holds", () => {
    sang("2026-02-01", "a");
    sang("2026-02-08", "b");
    presentations.apply({ type: "setUsagePeriod", from: "2026-01-01", to: "2026-06-30" });

    expect(presentations.state().usage).toMatchObject({
      from: "2026-01-01",
      to: "2026-06-30",
      songs: 1,
      services: 2,
      missingNumbers: 0,
    });
  });

  it("leaves out a service outside the period", () => {
    sang("2026-02-01", "a");
    presentations.apply({ type: "setUsagePeriod", from: "2026-03-01", to: "2026-06-30" });
    expect(presentations.state().usage.songs).toBe(0);
  });

  it("puts a period typed backwards the right way round", () => {
    expect(
      presentations.apply({ type: "setUsagePeriod", from: "2026-06-30", to: "2026-01-01" }),
    ).toBe(true);
    expect(presentations.state().usage).toMatchObject({ from: "2026-01-01", to: "2026-06-30" });
  });

  it("refuses a period with an end missing", () => {
    expect(presentations.apply({ type: "setUsagePeriod", from: "", to: "2026-06-30" })).toBe(false);
  });

  it("says how many songs have no CCLI number, because the church decides", () => {
    opened.library.save(holyHolyHoly);
    opened.library.logUsage({
      songId: holyHolyHoly.song.id,
      title: holyHolyHoly.song.title,
      ccliNumber: null,
      serviceDate: "2026-02-01",
      setListId: "a",
      shownAt: "2026-02-01T10:00:00Z",
    });
    presentations.apply({ type: "setUsagePeriod", from: "2026-01-01", to: "2026-06-30" });
    expect(presentations.state().usage.missingNumbers).toBe(1);
  });
});
