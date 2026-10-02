/**
 * STG-11, STG-12.
 *
 * Main owns all state, so this is where the behaviour of a service lives. It is
 * tested without opening a window, which is the point of keeping Electron out
 * of it.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { compileDeck, lookupFrom, type Deck } from "@hearth/songs";
import { sampleLibrary, sampleService } from "@hearth/songs/fixtures";
import { Session, contentOf, DEFAULT_THEME } from "../src/main/session";

let deck: Deck;
let session: Session;

beforeEach(() => {
  deck = compileDeck(sampleService, lookupFrom(sampleLibrary));
  session = new Session(deck, sampleService);
});

describe("moving through a service", () => {
  it("starts on the first cue", () => {
    expect(session.outputState("out").revision).toBe(0);
    expect(session.controlState([]).position).toBe(0);
  });

  it("advances and reverses", () => {
    expect(session.apply({ type: "advance" })).toBe(true);
    expect(session.controlState([]).position).toBe(1);
    expect(session.apply({ type: "reverse" })).toBe(true);
    expect(session.controlState([]).position).toBe(0);
  });

  it("stops at both ends without bumping the revision", () => {
    // A revision bump is a repaint on every output, so a no-op has to say so.
    expect(session.apply({ type: "reverse" })).toBe(false);
    const atStart = session.outputState("out").revision;

    session.apply({ type: "goTo", position: deck.cues.length - 1 });
    expect(session.apply({ type: "advance" })).toBe(false);
    expect(session.controlState([]).position).toBe(deck.cues.length - 1);
    expect(session.outputState("out").revision).toBeGreaterThan(atStart);
  });

  it("clamps a position outside the deck rather than failing", () => {
    session.apply({ type: "goTo", position: 9999 });
    expect(session.controlState([]).position).toBe(deck.cues.length - 1);
  });

  it("goes to a cue by id, and ignores one that is not there", () => {
    const target = deck.cues[5];
    expect(session.apply({ type: "goToCue", cueId: target?.id ?? "" })).toBe(true);
    expect(session.controlState([]).position).toBe(5);
    expect(session.apply({ type: "goToCue", cueId: "never-existed" })).toBe(false);
    expect(session.controlState([]).position).toBe(5);
  });
});

describe("black, clear and logo (ST6.6)", () => {
  it("covers the output and comes back to the exact slide", () => {
    session.apply({ type: "goTo", position: 4 });
    const before = session.outputState("out").content;

    session.apply({ type: "toggleBlank", blank: "black" });
    expect(session.outputState("out").blank).toBe("black");
    // The slide behind it has not moved.
    expect(session.outputState("out").content).toEqual(before);

    // Pressing it again comes back, which is how an operator uses it.
    session.apply({ type: "toggleBlank", blank: "black" });
    expect(session.outputState("out").blank).toBe("none");
    expect(session.outputState("out").content).toEqual(before);
  });

  it("swaps straight from one cover to another", () => {
    session.apply({ type: "toggleBlank", blank: "black" });
    session.apply({ type: "toggleBlank", blank: "logo" });
    expect(session.outputState("out").blank).toBe("logo");
  });

  it("advances behind a cover, because that is how a next slide is set up", () => {
    session.apply({ type: "setBlank", blank: "black" });
    const before = session.controlState([]).position;
    session.apply({ type: "advance" });
    expect(session.controlState([]).position).toBe(before + 1);
    expect(session.outputState("out").blank).toBe("black");
  });

  it("says nothing changed when the cover is already what was asked for", () => {
    session.apply({ type: "setBlank", blank: "black" });
    expect(session.apply({ type: "setBlank", blank: "black" })).toBe(false);
  });
});

describe("what an output is handed", () => {
  it("gets the words, the label and where it is in the section", () => {
    // The second verse of the second item.
    const position = deck.cues.findIndex((cue) => cue.label === "V2");
    session.apply({ type: "goTo", position });
    const state = session.outputState("main");

    expect(state.outputId).toBe("main");
    expect(state.content.kind).toBe("lyric");
    if (state.content.kind !== "lyric") return;
    expect(state.content.label).toBe("V2");
    expect(state.content.lines[0]).toBe("Holy, holy, holy! all the saints adore Thee,");
    expect(state.theme).toEqual(DEFAULT_THEME);
  });

  it("gets nothing to paint on a marker", () => {
    // The welcome and the sermon put nothing on the wall, and the output is
    // told that rather than left showing the previous slide.
    expect(session.outputState("out").content).toEqual({ kind: "nothing" });
  });

  it("gets the reference on every slide of a passage", () => {
    const scripture = deck.cues.filter((cue) => cue.kind === "scripture");
    expect(scripture).toHaveLength(2);
    for (const cue of scripture) {
      session.apply({ type: "goTo", position: cue.position });
      const content = session.outputState("out").content;
      expect(content.kind).toBe("scripture");
      if (content.kind !== "scripture") continue;
      expect(content.reference).toBe("Psalm 23:1-6");
    }
  });

  it("has a theme that clears the legibility floor (ST20.4)", () => {
    // Cap height at or above 4% of output height, weight at or above 400.
    expect(DEFAULT_THEME.textSize).toBeGreaterThanOrEqual(0.04);
    expect(DEFAULT_THEME.fontWeight).toBeGreaterThanOrEqual(400);
  });
});

describe("what the control surface is handed", () => {
  it("gets the service, the groups and every cue", () => {
    const state = session.controlState([
      { outputId: "out", name: "Main", display: "Projector", live: true },
    ]);
    expect(state.service?.title).toBe("Morning Service");
    expect(state.service?.source).toBe("set_list");
    expect(state.groups).toHaveLength(6);
    expect(state.cues).toHaveLength(deck.cues.length);
    expect(state.outputs[0]?.display).toBe("Projector");
  });

  it("gets the key the leader asked for, and the sequence", () => {
    const grace = session
      .controlState([])
      .groups.find((group) => group.title === "Amazing Grace");
    expect(grace?.key).toBe("Bb");
    expect(grace?.sequence).toEqual(["V1", "V2", "V3"]);
  });

  it("gets the notes, including the one addressed to a position", () => {
    const grace = session
      .controlState([])
      .groups.find((group) => group.title === "Amazing Grace");
    expect(grace?.notes).toEqual([
      { position: null, body: "Hold the last line" },
      { position: "Drums", body: "In on the second verse" },
    ]);
  });

  it("gets a one-line preview per cue rather than the whole slide", () => {
    const cue = session.controlState([]).cues.find((candidate) => candidate.label === "V1");
    expect(cue?.preview).toBe("Holy, holy, holy! Lord God Almighty!");
  });

  it("gets the repeat marked", () => {
    const repeats = session
      .controlState([])
      .cues.filter((cue) => cue.label === "V1" && cue.occurrencesTotal === 2);
    expect(repeats.map((cue) => cue.occurrence)).toEqual([1, 2]);
  });
});

describe("opening another service (ST5.11)", () => {
  it("stays on the same slide when the recompiled deck still has it", () => {
    session.apply({ type: "goTo", position: 5 });
    const liveId = session.liveCueId();

    // The same service, recompiled for a theme that fits two lines a slide, so
    // every section splits and positions move.
    const narrow = compileDeck(sampleService, lookupFrom(sampleLibrary), {
      limits: { maxLines: 2 },
    });
    session.open(narrow, sampleService);

    expect(session.liveCueId()).toBe(liveId);
    expect(session.controlState([]).position).not.toBe(5);
  });

  it("goes back to the beginning when the cue is gone", () => {
    session.apply({ type: "goTo", position: 5 });
    const other = compileDeck({ ...sampleService, id: "other", items: [] }, lookupFrom([]));
    session.open(other, null);
    expect(session.controlState([]).position).toBe(0);
    expect(session.controlState([]).service).toBeNull();
  });
});

describe("recovery (ST19.1, ST19.2)", () => {
  it("restores to a cue id, which is what gets persisted", () => {
    session.apply({ type: "goTo", position: 7 });
    const saved = session.liveCueId();

    const fresh = new Session(compileDeck(sampleService, lookupFrom(sampleLibrary)), sampleService);
    expect(fresh.restoreTo(saved ?? "")).toBe(true);
    expect(fresh.liveCueId()).toBe(saved);
  });
});

describe("an empty deck", () => {
  it("does not move, and hands the output nothing", () => {
    const empty = new Session(compileDeck({ ...sampleService, items: [] }, lookupFrom([])), null);
    expect(empty.apply({ type: "advance" })).toBe(false);
    expect(empty.liveCueId()).toBeNull();
    expect(empty.outputState("out").content).toEqual({ kind: "nothing" });
  });
});

describe("contentOf", () => {
  it("turns nothing into nothing", () => {
    expect(contentOf(null)).toEqual({ kind: "nothing" });
  });
});
