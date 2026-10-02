/**
 * STG-4, ST5.1, ST5.2, ST5.4.
 *
 * The deck is the service, compiled. These are the golden expectations: the
 * same service compiles to the same cues every time, and every way it can be
 * wrong is reported at the moment it is opened rather than at 10:31 on a Sunday.
 */
import { describe, it, expect } from "vitest";
import {
  amazingGrace,
  blankArrangement,
  blankSection,
  blankWholeSong,
  holyHolyHoly,
  sampleLibrary,
  sundayService,
} from "../src/fixtures";
import {
  compileDeck,
  cueAt,
  deckIsComplete,
  groupOf,
  lookupFrom,
  nextCue,
  positionOf,
} from "../src/deck";
import type { ServicePlan } from "../src/service";

const library = lookupFrom(sampleLibrary);

function deck(plan: ServicePlan = sundayService, maxLines = 4) {
  return compileDeck(plan, library, { limits: { maxLines } });
}

describe("a Sunday service, compiled", () => {
  it("produces the same deck every time", () => {
    const first = deck();
    const second = deck();
    expect(first.cues.map((cue) => cue.id)).toEqual(second.cues.map((cue) => cue.id));
    expect(first.problems).toEqual([]);
    expect(deckIsComplete(first)).toBe(true);
  });

  it("keeps the items in the order the service runs", () => {
    expect(deck().groups.map((group) => group.title)).toEqual([
      "Welcome",
      "Holy, Holy, Holy",
      "Amazing Grace",
      "Psalm 23",
      "The Good Shepherd",
      "Amazing Grace (reprise)",
    ]);
  });

  it("gives the sermon a cue with nothing on the wall", () => {
    // ST5.4. The operator's position in the deck has to match the service's
    // position in the room, so a non-presenting item is still a cue.
    const sermon = deck().groups.find((group) => group.title === "The Good Shepherd");
    expect(sermon?.kind).toBe("marker");
    expect(sermon?.cues).toHaveLength(1);
    expect(sermon?.cues[0]?.lines).toBeNull();
  });

  it("numbers every cue once, across the whole deck", () => {
    const compiled = deck();
    expect(compiled.cues.map((cue) => cue.position)).toEqual(
      compiled.cues.map((unused, index) => index),
    );
    expect(compiled.groups.flatMap((group) => group.cues)).toHaveLength(compiled.cues.length);
  });
});

describe("a song becomes slides by its sequence (ST5.2)", () => {
  it("turns a repeat into separate cues", () => {
    // "V1 V2 V1" is three cues, and the two V1 cues have different ids so a
    // restored pointer lands on the right one.
    const group = deck().groups.find((candidate) => candidate.title === "Holy, Holy, Holy");
    expect(group?.cues.map((cue) => cue.label)).toEqual(["V1", "V2", "V1"]);
    expect(group?.cues.map((cue) => cue.occurrence)).toEqual([1, 1, 2]);
    expect(new Set(group?.cues.map((cue) => cue.id)).size).toBe(3);
  });

  it("carries the label and section type for the confidence monitor, and the words for the wall", () => {
    const cue = deck().cues.find((candidate) => candidate.label === "V2");
    expect(cue?.sectionType).toBe("verse");
    expect(cue?.lines?.[0]).toBe("Holy, holy, holy! all the saints adore Thee,");
  });

  it("reports the key the leader asked for rather than the arrangement's", () => {
    // ST5.6. The arrangement is in G and this Sunday is in Bb.
    const group = deck().groups.find((candidate) => candidate.title === "Amazing Grace");
    expect(amazingGrace.arrangements.find((a) => a.id === "ag-sunday")?.key).toBe("G");
    expect(group?.key).toBe("Bb");
  });

  it("takes the arrangement's own key where nothing was overridden", () => {
    const group = deck().groups.find((candidate) => candidate.title === "Amazing Grace (reprise)");
    expect(group?.key).toBe("D");
    expect(group?.cues.map((cue) => cue.label)).toEqual(["V1", "V3"]);
  });

  it("splits a long section across cues when the theme allows fewer lines", () => {
    const tight = deck(sundayService, 2);
    const group = tight.groups.find((candidate) => candidate.title === "Holy, Holy, Holy");
    // Three sections of four lines, two lines a slide, so six cues.
    expect(group?.cues).toHaveLength(6);
    expect(group?.cues[0]?.slideCount).toBe(2);
    expect(group?.cues[0]?.slideIndex).toBe(0);
    expect(group?.cues[1]?.slideIndex).toBe(1);
  });
});

describe("scripture (ST7.3)", () => {
  it("breaks at verse boundaries and keeps the reference on every slide", () => {
    const group = deck().groups.find((candidate) => candidate.title === "Psalm 23");
    expect(group?.cues).toHaveLength(2);
    expect(group?.cues.every((cue) => cue.reference === "Psalm 23:1-6")).toBe(true);
    // Six verses, four a slide.
    expect(group?.cues[0]?.lines).toHaveLength(4);
    expect(group?.cues[1]?.lines).toHaveLength(2);
    expect(group?.cues[0]?.lines?.[0]?.startsWith("1 ")).toBe(true);
    expect(group?.cues[1]?.lines?.[0]?.startsWith("5 ")).toBe(true);
  });

  it("reports a scripture item with no text", () => {
    const plan: ServicePlan = {
      ...sundayService,
      items: [
        {
          type: "scripture",
          id: "item-empty",
          sortOrder: 0,
          title: "A reading",
          durationSeconds: null,
          notes: [],
          reference: "John 3:16",
          translation: "NIV",
          verses: [],
        },
      ],
    };
    expect(compileDeck(plan, library).problems).toEqual([
      { code: "item.scripture.empty", itemId: "item-empty", reference: "John 3:16" },
    ]);
  });
});

describe("what it refuses to do quietly", () => {
  it("reports a song the library does not have", () => {
    const plan: ServicePlan = {
      ...sundayService,
      items: [
        {
          type: "song",
          id: "item-ghost",
          sortOrder: 0,
          title: "Something Somebody Deleted",
          durationSeconds: 300,
          notes: [],
          songId: "song-gone",
          arrangementId: null,
          keyOverride: null,
        },
      ],
    };
    const compiled = compileDeck(plan, library);
    expect(compiled.groups).toEqual([]);
    expect(compiled.problems).toEqual([
      {
        code: "item.song.missing",
        itemId: "item-ghost",
        songId: "song-gone",
        title: "Something Somebody Deleted",
      },
    ]);
    expect(deckIsComplete(compiled)).toBe(false);
  });

  it("names the item and the label when a sequence does not resolve", () => {
    const broken = blankWholeSong({
      song: { ...blankWholeSong().song, id: "song-broken" },
      sections: [blankSection({ songId: "song-broken", label: "V1" })],
      arrangements: [blankArrangement({ songId: "song-broken", sequence: ["V1", "C"] })],
    });
    const plan: ServicePlan = {
      ...sundayService,
      items: [
        {
          type: "song",
          id: "item-broken",
          sortOrder: 0,
          title: "Half a song",
          durationSeconds: null,
          notes: [],
          songId: "song-broken",
          arrangementId: null,
          keyOverride: null,
        },
      ],
    };
    const compiled = compileDeck(plan, lookupFrom([broken]));
    expect(compiled.problems).toEqual([
      {
        code: "sequence.unknownLabel",
        arrangementName: "Default",
        label: "C",
        position: 1,
        itemId: "item-broken",
        title: "Half a song",
      },
    ]);
    // The sections that did resolve still present, so one bad label does not
    // take the whole song off the screen.
    expect(compiled.groups[0]?.cues).toHaveLength(1);
  });

  it("compiles items in sortOrder, whatever order they are stored in", () => {
    const shuffled: ServicePlan = {
      ...sundayService,
      items: [...sundayService.items].reverse(),
    };
    expect(compileDeck(shuffled, library).groups.map((group) => group.title)).toEqual(
      deck().groups.map((group) => group.title),
    );
  });
});

describe("moving through a deck", () => {
  it("finds a cue, the one after it, and its group", () => {
    const compiled = deck();
    const first = cueAt(compiled, 0);
    expect(first?.kind).toBe("marker");
    expect(nextCue(compiled, 0)?.label).toBe("V1");
    expect(groupOf(compiled, first as never)?.title).toBe("Welcome");
    expect(nextCue(compiled, compiled.cues.length - 1)).toBeNull();
  });

  it("finds a cue again after a recompile, which is how a restart recovers", () => {
    // ST19.1. A persisted cue id has to land on the same slide, so the ids are
    // stable across compiles of the same service.
    const before = deck();
    const live = before.cues[6];
    const after = deck();
    expect(positionOf(after, live?.id ?? "")).toBe(6);
    expect(positionOf(after, "cue-that-never-existed")).toBeNull();
  });

  it("keeps a cue id stable when the lines around it change size", () => {
    // Recompiling at a different line limit changes how many cues a section
    // becomes, so an id carries the section and the occurrence rather than a
    // position.
    const wide = deck(sundayService, 4);
    const narrow = deck(sundayService, 2);
    const firstV1Wide = wide.cues.find((cue) => cue.label === "V1");
    const firstV1Narrow = narrow.cues.find((cue) => cue.label === "V1");
    expect(firstV1Wide?.id).toBe(firstV1Narrow?.id);
    expect(narrow.cues.length).toBeGreaterThan(wide.cues.length);
  });
});

describe("the fixtures themselves", () => {
  it("are the songs the service asks for", () => {
    expect(sampleLibrary.map((whole) => whole.song.id).sort()).toEqual([
      "song-amazing-grace",
      "song-holy",
    ]);
    expect(holyHolyHoly.arrangements[0]?.sequence).toEqual(["V1", "V2", "V1"]);
  });
});
