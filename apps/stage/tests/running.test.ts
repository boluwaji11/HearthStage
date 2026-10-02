/**
 * STG-24, ST5.7. The order a service actually runs in.
 *
 * The requirement is one sentence and it is the whole point: this affects the
 * run, and never writes back. So most of these tests are about what a change
 * does not do, and the last one is about putting it all back.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { compileDeck, lookupFrom, type Deck } from "@hearth/songs";
import { sampleLibrary, sampleService } from "@hearth/songs/fixtures";
import { applyChange, asPlanned, runFrom, showing, type RunEntry } from "../src/main/running";

let deck: Deck;
let order: RunEntry[];

beforeEach(() => {
  deck = compileDeck(sampleService, lookupFrom(sampleLibrary));
  order = runFrom(deck);
});

/** The cue ids in the order they would be shown. */
function shown(entries: RunEntry[]): string[] {
  return showing(entries).map((entry) => entry.cueId);
}

describe("the order a service starts in", () => {
  it("is the one the church planned", () => {
    expect(shown(order)).toEqual(deck.cues.map((cue) => cue.id));
    expect(asPlanned(order, deck)).toBe(true);
  });

  it("gives every entry its own identity, so a repeat can be told apart", () => {
    expect(new Set(order.map((entry) => entry.id)).size).toBe(order.length);
  });
});

describe("skipping a cue", () => {
  it("takes it out of what will be shown and leaves it in the list", () => {
    const first = order[1] as RunEntry;
    const after = applyChange(order, first.id, "skip");
    if (after === null) throw new Error("nothing changed");

    expect(after).toHaveLength(order.length);
    expect(shown(after)).not.toContain(first.cueId);
    expect(after[1]?.skipped).toBe(true);
  });

  it("puts it back on the second press, because an operator changes their mind", () => {
    const first = order[1] as RunEntry;
    const off = applyChange(order, first.id, "skip");
    if (off === null) throw new Error("nothing changed");
    const on = applyChange(off, first.id, "skip");
    expect(shown(on ?? [])).toEqual(shown(order));
  });
});

describe("repeating a cue", () => {
  it("puts a copy straight after it, which is where a chorus goes again", () => {
    const chorus = order[1] as RunEntry;
    const after = applyChange(order, chorus.id, "repeat");
    if (after === null) throw new Error("nothing changed");

    expect(after).toHaveLength(order.length + 1);
    expect(after[1]?.cueId).toBe(chorus.cueId);
    expect(after[2]?.cueId).toBe(chorus.cueId);
    expect(after[2]?.repeat).toBe(true);
    expect(after[2]?.id).not.toBe(after[1]?.id);
  });

  it("can be done again, and the two copies are separate entries", () => {
    const chorus = order[1] as RunEntry;
    const twice = applyChange(applyChange(order, chorus.id, "repeat") ?? [], chorus.id, "repeat");
    if (twice === null) throw new Error("nothing changed");
    expect(twice.filter((entry) => entry.cueId === chorus.cueId)).toHaveLength(3);
    expect(new Set(twice.map((entry) => entry.id)).size).toBe(twice.length);
  });

  it("takes a copy away again", () => {
    const chorus = order[1] as RunEntry;
    const added = applyChange(order, chorus.id, "repeat");
    if (added === null) throw new Error("nothing changed");
    const copy = added[2] as RunEntry;
    expect(shown(applyChange(added, copy.id, "drop") ?? [])).toEqual(shown(order));
  });

  it("never takes away a cue the set list put there, because skip is for that", () => {
    const planned = order[1] as RunEntry;
    expect(applyChange(order, planned.id, "drop")).toBeNull();
  });
});

describe("moving a cue", () => {
  it("swaps it with its neighbour", () => {
    const second = order[1] as RunEntry;
    const after = applyChange(order, second.id, "down");
    if (after === null) throw new Error("nothing changed");
    expect(after[1]?.id).toBe(order[2]?.id);
    expect(after[2]?.id).toBe(second.id);
  });

  it("stays inside its own item, because the room has the order on paper", () => {
    // The last cue of a group cannot move down into the next one.
    const groupOf = (entry: RunEntry): string => entry.groupId;
    const lastOfFirst = [...order].reverse().find((entry) => groupOf(entry) === groupOf(order[0] as RunEntry));
    if (lastOfFirst === undefined) throw new Error("no group");
    expect(applyChange(order, lastOfFirst.id, "down")).toBeNull();
    expect(applyChange(order, (order[0] as RunEntry).id, "up")).toBeNull();
  });
});

describe("what none of it touches", () => {
  it("leaves the set list and the deck exactly as they were", () => {
    const planAsWas = JSON.stringify(sampleService);
    const deckAsWas = JSON.stringify(deck);

    let after = order;
    for (const change of ["skip", "repeat", "down"] as const) {
      after = applyChange(after, (after[1] as RunEntry).id, change) ?? after;
    }

    expect(JSON.stringify(sampleService)).toBe(planAsWas);
    expect(JSON.stringify(deck)).toBe(deckAsWas);
    expect(after).not.toEqual(order);
  });

  it("knows when it is no longer the planned order", () => {
    expect(asPlanned(applyChange(order, (order[1] as RunEntry).id, "down") ?? [], deck)).toBe(false);
    expect(asPlanned(applyChange(order, (order[1] as RunEntry).id, "skip") ?? [], deck)).toBe(false);
    expect(asPlanned(applyChange(order, (order[1] as RunEntry).id, "repeat") ?? [], deck)).toBe(false);
    expect(asPlanned(runFrom(deck), deck)).toBe(true);
  });

  it("does nothing on an entry that is not there", () => {
    expect(applyChange(order, "nothing", "skip")).toBeNull();
  });
});
