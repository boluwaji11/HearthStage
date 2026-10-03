/**
 * STG-11, STG-12.
 *
 * Main owns all state, so this is where the behaviour of a service lives. It is
 * tested without opening a window, which is the point of keeping Electron out
 * of it.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  compileDeck,
  lookupFrom,
  songPlan,
  withItem,
  type Deck,
  type ServicePlan,
} from "@hearth/songs";
import { holyHolyHoly, sampleLibrary, sampleService } from "@hearth/songs/fixtures";
import { readFileSync } from "node:fs";
import { REPEAT_GUARD_MS, Session, contentOf, DEFAULT_THEME } from "../src/main/session";

/** A service with nothing in it, which is what the application starts on. */
const EMPTY: ServicePlan = {
  id: "nothing",
  source: "set_list",
  title: "",
  date: "",
  startsAt: null,
  items: [],
};

let deck: Deck;
let session: Session;
/**
 * A clock that moves a second on every reading (STG-23).
 *
 * The repeat guard refuses a second key inside sixty milliseconds, and a test
 * presses twice in the same millisecond. Holding time still and moving it on
 * purpose is how the guard gets tested rather than tripped over.
 */
let clock: number;

function tick(): number {
  clock += 1000;
  return clock;
}

beforeEach(() => {
  clock = 0;
  deck = compileDeck(sampleService, lookupFrom(sampleLibrary));
  session = new Session(deck, sampleService, { now: tick });
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

/**
 * STG-22, ST6.6. The three covers, each one keypress, independent of where the
 * deck is.
 *
 * What STG-11 built is above. What this adds is the two cases an operator meets
 * and a deck test does not: a church with nothing open at all, and the one key
 * that comes back from whichever cover is up.
 */
describe("clearing the room", () => {
  it("works with no service open, because the room is a room either way", () => {
    const nothing = new Session(compileDeck(EMPTY, lookupFrom([])), null);
    expect(nothing.apply({ type: "setBlank", blank: "black" })).toBe(true);
    expect(nothing.outputState("out").blank).toBe("black");
    expect(nothing.apply({ type: "toggleBlank", blank: "black" })).toBe(true);
    expect(nothing.outputState("out").blank).toBe("none");
  });

  it("comes back from whichever cover is up, on the one key", () => {
    for (const cover of ["black", "clear", "logo"] as const) {
      session.apply({ type: "setBlank", blank: cover });
      expect(session.outputState("out").blank).toBe(cover);
      expect(session.apply({ type: "setBlank", blank: "none" })).toBe(true);
      expect(session.outputState("out").blank).toBe("none");
    }
  });

  it("leaves the deck where it was through all three", () => {
    session.apply({ type: "goTo", position: 3 });
    const before = session.liveCueId();
    for (const cover of ["black", "clear", "logo"] as const) {
      session.apply({ type: "setBlank", blank: cover });
      expect(session.liveCueId()).toBe(before);
    }
    session.apply({ type: "setBlank", blank: "none" });
    expect(session.liveCueId()).toBe(before);
  });
});

/**
 * STG-23, ST12.4. One cue per press, however the press arrives.
 *
 * The window drops the repeat the operating system flags, and this is the other
 * half. A presentation clicker with a tired switch sends two events in a
 * handful of milliseconds and flags neither, and the room sees two cues go past
 * for one press of a thumb.
 */
describe("a key held down", () => {
  /** A session on a clock a test moves by hand. */
  function held(): { session: Session; at: (ms: number) => void } {
    let at = 1_000_000;
    const made = new Session(deck, sampleService, { now: () => at });
    return { session: made, at: (ms: number) => (at = 1_000_000 + ms) };
  }

  it("moves one cue through two seconds of repeat", () => {
    const { session: run, at } = held();
    // What auto-repeat looks like at main: an event every thirty milliseconds
    // for as long as a finger stays down.
    for (let ms = 0; ms <= 2000; ms += 30) {
      at(ms);
      run.apply({ type: "advance" });
    }
    expect(run.controlState([]).position).toBe(1);
  });

  it("moves again once the presses stop coming", () => {
    const { session: run, at } = held();
    at(0);
    expect(run.apply({ type: "advance" })).toBe(true);

    // A bounce, inside the guard. It is refused, and it counts as a press, so
    // the gap is measured from it. Otherwise a key held down would walk the
    // deck at one cue per guard.
    at(REPEAT_GUARD_MS - 1);
    expect(run.apply({ type: "advance" })).toBe(false);

    at(REPEAT_GUARD_MS * 2);
    expect(run.apply({ type: "advance" })).toBe(true);
    expect(run.controlState([]).position).toBe(2);
  });

  it("takes a second press at the speed a person presses", () => {
    const { session: run, at } = held();
    // Four deliberate presses, a fifth of a second apart, which is a quick
    // operator rather than a key stuck down.
    for (let ms = 0; ms < 800; ms += 200) {
      at(ms);
      expect(run.apply({ type: "advance" }), `at ${ms}ms`).toBe(true);
    }
    expect(run.controlState([]).position).toBe(4);
  });

  it("holds a reverse to one as well, because a clicker has two buttons", () => {
    const { session: run, at } = held();
    at(0);
    run.apply({ type: "goTo", position: 5 });
    at(10);
    run.apply({ type: "reverse" });
    at(20);
    run.apply({ type: "reverse" });
    at(30);
    run.apply({ type: "reverse" });
    expect(run.controlState([]).position).toBe(4);
  });

  it("never guards a cue somebody chose, because there is no repeat in a click", () => {
    const { session: run, at } = held();
    at(0);
    const second = deck.cues[2]?.id ?? "";
    const third = deck.cues[3]?.id ?? "";
    expect(run.apply({ type: "goToCue", cueId: second })).toBe(true);
    expect(run.apply({ type: "goToCue", cueId: third })).toBe(true);
    expect(run.apply({ type: "goTo", position: 0 })).toBe(true);
  });

  it("does not leave a stale guard at the end of a service", () => {
    const { session: run, at } = held();
    at(0);
    run.apply({ type: "goTo", position: deck.cues.length - 1 });
    // Held against the end for a while, then pressed back.
    for (let ms = 10; ms < 500; ms += 30) {
      at(ms);
      run.apply({ type: "advance" });
    }
    at(600);
    expect(run.apply({ type: "reverse" })).toBe(true);
  });
});

/**
 * STG-24, ST5.7. The order this run goes in.
 *
 * The pure half is in `running.test.ts`. This is what an operator sees: the
 * room moving on when the live verse is taken out, staying put when a later one
 * is, and the set list being exactly where it was through all of it.
 */
describe("changing the order mid service", () => {
  /** The entry ids in the order they will be shown. */
  function showing(): string[] {
    return session
      .controlState([])
      .cues.filter((cue) => !cue.skipped)
      .map((cue) => cue.entryId);
  }

  function entryAt(position: number): string {
    return session.controlState([]).cues[position]?.entryId ?? "";
  }

  it("steps over a skipped cue on the way through", () => {
    session.apply({ type: "runChange", entryId: entryAt(1), change: "skip" });
    expect(session.controlState([]).position).toBe(0);
    session.apply({ type: "advance" });
    expect(session.controlState([]).position).toBe(2);
  });

  it("moves the room on when what is live is taken out", () => {
    session.apply({ type: "goTo", position: 2 });
    const after = entryAt(3);
    session.apply({ type: "runChange", entryId: entryAt(2), change: "skip" });
    expect(entryAt(session.controlState([]).position)).toBe(after);
  });

  it("leaves the room alone when a later cue is taken out", () => {
    session.apply({ type: "goTo", position: 1 });
    const live = session.liveCueId();
    session.apply({ type: "runChange", entryId: entryAt(4), change: "skip" });
    expect(session.liveCueId()).toBe(live);
  });

  it("shows a repeated cue again on the next advance", () => {
    session.apply({ type: "goTo", position: 1 });
    const live = session.liveCueId();
    session.apply({ type: "runChange", entryId: entryAt(1), change: "repeat" });
    expect(session.liveCueId()).toBe(live);
    session.apply({ type: "advance" });
    expect(session.liveCueId()).toBe(live);
  });

  it("will not jump to a cue that is out of this run", () => {
    const skipped = entryAt(3);
    session.apply({ type: "runChange", entryId: skipped, change: "skip" });
    expect(session.apply({ type: "goToCue", cueId: skipped })).toBe(false);
  });

  it("says whether the run is still what the church planned", () => {
    expect(session.controlState([]).asPlanned).toBe(true);
    session.apply({ type: "runChange", entryId: entryAt(1), change: "skip" });
    expect(session.controlState([]).asPlanned).toBe(false);
  });

  it("puts it all back, and stays on the slide the room is looking at", () => {
    session.apply({ type: "goTo", position: 4 });
    const live = session.liveCueId();
    const planned = showing();

    session.apply({ type: "runChange", entryId: entryAt(1), change: "skip" });
    session.apply({ type: "runChange", entryId: entryAt(2), change: "repeat" });
    expect(showing()).not.toEqual(planned);

    expect(session.apply({ type: "resetRun" })).toBe(true);
    expect(showing()).toEqual(planned);
    expect(session.liveCueId()).toBe(live);
    expect(session.controlState([]).asPlanned).toBe(true);
  });

  it("says nothing changed where the run is already the planned one", () => {
    expect(session.apply({ type: "resetRun" })).toBe(false);
  });

  it("never writes any of it back to the set list", () => {
    const planAsWas = JSON.stringify(sampleService);
    session.apply({ type: "runChange", entryId: entryAt(1), change: "skip" });
    session.apply({ type: "runChange", entryId: entryAt(2), change: "repeat" });
    session.apply({ type: "runChange", entryId: entryAt(2), change: "down" });
    expect(JSON.stringify(sampleService)).toBe(planAsWas);

    // Opening the service again is the order the church planned, because the
    // changes were never anywhere but this run.
    session.open(compileDeck(sampleService, lookupFrom(sampleLibrary)), sampleService);
    expect(session.controlState([]).asPlanned).toBe(true);
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

describe("what a compile problem says to the operator", () => {
  it("names the item on a scripture passage with no text, which has no title", () => {
    const plan: ServicePlan = {
      id: "plan-1",
      source: "set_list",
      title: "Morning Service",
      date: "2026-10-04",
      startsAt: null,
      items: [
        {
          type: "scripture",
          id: "item-reading",
          sortOrder: 0,
          title: "Psalm 23",
          durationSeconds: null,
          notes: [],
          reference: "Psalm 23:1-6",
          translation: "KJV",
          verses: [],
        },
      ],
    };

    const session = new Session(compileDeck(plan, lookupFrom([])), plan);
    expect(session.controlState([]).problems).toEqual([
      { code: "item.scripture.empty", detail: "Psalm 23:1-6" },
    ]);
  });

  it("names the song a service asks for and the library does not have", () => {
    const plan: ServicePlan = {
      id: "plan-2",
      source: "set_list",
      title: "Morning Service",
      date: "2026-10-04",
      startsAt: null,
      items: [
        {
          type: "song",
          id: "item-song",
          sortOrder: 0,
          title: "Holy, Holy, Holy",
          durationSeconds: null,
          notes: [],
          songId: "song-holy",
          arrangementId: null,
          keyOverride: null,
        },
      ],
    };

    const session = new Session(compileDeck(plan, lookupFrom([])), plan);
    expect(session.controlState([]).problems).toEqual([
      { code: "item.song.missing", detail: "Holy, Holy, Holy" },
    ]);
  });
});

describe("what the operator's panes are handed", () => {
  const deck = compileDeck(sampleService, lookupFrom(sampleLibrary));

  it("gives the live pane the whole slide, rather than a first line", () => {
    const session = new Session(deck, sampleService);
    session.apply({ type: "goTo", position: 1 });

    const state = session.controlState([]);
    const live = session.outputState("display:1");

    // The same content object the room is painting from, so the two cannot say
    // different things.
    expect(state.live?.content).toEqual(live.content);
    expect(state.live?.theme).toEqual(live.theme);
  });

  it("gives the next pane the slide one keypress away", () => {
    const session = new Session(deck, sampleService);
    session.apply({ type: "goTo", position: 1 });

    const after = new Session(deck, sampleService);
    after.apply({ type: "goTo", position: 2 });

    expect(session.controlState([]).next?.content).toEqual(
      after.outputState("display:1").content,
    );
  });

  it("has no next at the end of the service", () => {
    const session = new Session(deck, sampleService);
    session.apply({ type: "goTo", position: deck.cues.length - 1 });
    expect(session.controlState([]).next).toBeNull();
  });

  it("keeps the slide under a cover, so the operator sees what the room sees", () => {
    const session = new Session(deck, sampleService);
    session.apply({ type: "goTo", position: 1 });
    const before = session.controlState([]).live?.content;

    session.apply({ type: "setBlank", blank: "black" });
    const after = session.controlState([]);

    // The slide is still there and the cover is reported, which is how the pane
    // can show black and come back to the exact slide (ST6.6).
    expect(after.blank).toBe("black");
    expect(after.live?.content).toEqual(before);
  });
});

describe("before anything is open", () => {
  const nothing: ServicePlan = {
    id: "nothing",
    source: "set_list",
    title: "",
    date: "",
    startsAt: null,
    items: [],
  };

  it("reports no service, which is what puts the three ways in on the screen", () => {
    const session = new Session(compileDeck(nothing, lookupFrom([])), null);
    const state = session.controlState([]);

    expect(state.service).toBeNull();
    expect(state.cues).toEqual([]);
    expect(state.live).toBeNull();
    expect(state.next).toBeNull();
    expect(state.problems).toEqual([]);
  });

  it("puts nothing on the output, rather than something left over", () => {
    const session = new Session(compileDeck(nothing, lookupFrom([])), null);
    expect(session.outputState("display:1").content).toEqual({ kind: "nothing" });
  });

  it("ignores an advance, so a key pressed at nothing changes nothing", () => {
    const session = new Session(compileDeck(nothing, lookupFrom([])), null);
    expect(session.apply({ type: "advance" })).toBe(false);
  });

  it("opens a service when one is chosen, and reports it", () => {
    const session = new Session(compileDeck(nothing, lookupFrom([])), null);
    session.open(compileDeck(sampleService, lookupFrom(sampleLibrary)), sampleService);

    const state = session.controlState([]);
    expect(state.service?.title).toBe("Morning Service");
    expect(state.cues.length).toBeGreaterThan(0);
    expect(state.live).not.toBeNull();
  });
});

/**
 * STG-49, ST5.8. The leader calls a song that is not in the set.
 *
 * The design case is 10:41, mid introduction. The room is looking at a slide
 * and must keep looking at it while this happens.
 */
describe("a song called from the floor", () => {
  function called(): { deck: Deck; plan: ServicePlan; groupId: string } {
    const item = { ...songPlan(holyHolyHoly).items[0]!, id: "called", sortOrder: 0 };
    const plan = withItem(sampleService, item, session.showingItemId());
    const bigger = compileDeck(plan, lookupFrom([...sampleLibrary, holyHolyHoly]));
    return { deck: bigger, plan, groupId: bigger.groups.find((one) => one.itemId === "called")!.id };
  }

  it("leaves the room looking at the same slide", () => {
    session.apply({ type: "advance" });
    session.apply({ type: "advance" });
    const before = session.controlState([]).live?.content;

    const { deck: bigger, plan, groupId } = called();
    expect(session.insert(bigger, plan, groupId, session.showingItemId())).toBe(true);
    expect(session.controlState([]).live?.content).toEqual(before);
  });

  it("puts it next, so the following press walks into it", () => {
    const after = session.showingItemId();
    const { deck: bigger, plan, groupId } = called();
    session.insert(bigger, plan, groupId, after);

    const state = session.controlState([]);
    const at = state.groups.findIndex((group) => group.id === groupId);
    const was = state.groups.findIndex((group) => group.id === deck.groups[0]?.id);
    expect(at).toBe(was + 1);
  });

  it("keeps a verse the operator skipped", () => {
    const entryId = session.controlState([]).cues[1]?.entryId ?? "";
    session.apply({ type: "runChange", entryId, change: "skip" });
    const skipped = session.controlState([]).cues.filter((cue) => cue.skipped).length;

    const { deck: bigger, plan, groupId } = called();
    session.insert(bigger, plan, groupId, session.showingItemId());

    expect(session.controlState([]).cues.filter((cue) => cue.skipped)).toHaveLength(skipped);
  });

  it("refuses a group the deck does not have", () => {
    const { deck: bigger, plan } = called();
    expect(session.insert(bigger, plan, "no-such-group", null)).toBe(false);
  });

  it("writes nothing, because the set list is what the church planned", () => {
    const source = readFileSync(
      new URL("../src/main/running.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/stage-store|save/i);
  });
});
