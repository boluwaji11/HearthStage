/**
 * STG-46, ST2.8. Set lists, against the real database.
 *
 * The two things worth defending: an order is written as one unit, and an entry
 * points at a library row rather than copying it, so archiving a hymn leaves
 * last Sunday's order readable and says what is missing.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { amazingGrace } from "@hearth/songs/fixtures";
import { newSetList, type SetEntry, type SetList } from "@hearth/songs";
import { openLibrary, type OpenLibrary } from "../src/index";

let directory: string;
let opened: OpenLibrary;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hearth-sets-"));
  opened = openLibrary(join(directory, "library.db"), { backups: false });
});

afterEach(() => {
  opened.close();
  rmSync(directory, { recursive: true, force: true });
});

function entry(sortOrder: number, title: string, itemId: string | null = null): SetEntry {
  return {
    id: `entry-${sortOrder}`,
    setListId: "set-1",
    sortOrder,
    kind: itemId === null ? "marker" : "item",
    itemId,
    title,
    notes: null,
  };
}

function morning(): SetList {
  return {
    ...newSetList("set-1", { title: "Morning Service", date: "2026-10-04" }),
    entries: [
      entry(0, "Welcome"),
      entry(1, "Amazing Grace", "song-amazing-grace"),
      entry(2, "Sermon"),
    ],
  };
}

describe("storing a running order", () => {
  it("writes it, entries and all, and reads it back in order", () => {
    opened.library.saveSetList(morning());
    const read = opened.library.getSetList("set-1");
    expect(read?.title).toBe("Morning Service");
    expect(read?.date).toBe("2026-10-04");
    expect(read?.entries.map((one) => one.title)).toEqual(["Welcome", "Amazing Grace", "Sermon"]);
    expect(read?.entries[1]?.itemId).toBe("song-amazing-grace");
    expect(read?.entries[0]?.kind).toBe("marker");
  });

  it("replaces the whole order rather than merging into it", () => {
    opened.library.saveSetList(morning());
    opened.library.saveSetList({ ...morning(), entries: [entry(0, "Welcome")] });
    expect(opened.library.getSetList("set-1")?.entries).toHaveLength(1);
  });

  it("numbers an entry by where it sits, so two orders cannot collide", () => {
    opened.library.saveSetList({ ...morning(), id: "a", title: "One" });
    opened.library.saveSetList({ ...morning(), id: "b", title: "Two" });
    const ids = [
      ...(opened.library.getSetList("a")?.entries ?? []),
      ...(opened.library.getSetList("b")?.entries ?? []),
    ].map((one) => one.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("renumbers the order it was given, so a gap cannot be stored", () => {
    opened.library.saveSetList({
      ...morning(),
      entries: [entry(9, "Last"), entry(2, "First")],
    });
    expect(opened.library.getSetList("set-1")?.entries.map((one) => one.sortOrder)).toEqual([0, 1]);
    expect(opened.library.getSetList("set-1")?.entries[0]?.title).toBe("First");
  });

  it("refuses one with no name, rather than storing a service nobody can find", () => {
    expect(() => opened.library.saveSetList({ ...morning(), title: "  " })).toThrow();
  });

  it("takes an empty one, because a church names Sunday before it fills it in", () => {
    opened.library.saveSetList(newSetList("set-2", { title: "Evening", date: "2026-10-04" }));
    expect(opened.library.getSetList("set-2")?.entries).toEqual([]);
  });
});

describe("finding one", () => {
  it("lists them newest service first", () => {
    opened.library.saveSetList({ ...morning(), id: "a", date: "2026-09-27", title: "Last week" });
    opened.library.saveSetList({ ...morning(), id: "b", date: "2026-10-04", title: "This week" });
    expect(opened.library.setLists().map((one) => one.title)).toEqual(["This week", "Last week"]);
  });

  it("counts what is in each, so a half built order is visible in the list", () => {
    opened.library.saveSetList(morning());
    expect(opened.library.setLists()[0]?.entries).toBe(3);
  });

  it("puts one away without deleting it", () => {
    opened.library.saveSetList(morning());
    expect(opened.library.archiveSetList("set-1")).toBe(true);
    expect(opened.library.setLists()).toEqual([]);
    expect(opened.library.getSetList("set-1")?.title).toBe("Morning Service");
  });
});

describe("what an entry points at", () => {
  it("says which table an item is in", () => {
    opened.library.save(amazingGrace);
    expect(opened.library.kindOf("song-amazing-grace")).toBe("song");
    expect(opened.library.kindOf("nothing")).toBeUndefined();
  });

  it("survives the item being archived, because an order still has to read", () => {
    opened.library.save(amazingGrace);
    opened.library.saveSetList(morning());
    opened.library.archive("song-amazing-grace");
    expect(opened.library.getSetList("set-1")?.entries[1]?.title).toBe("Amazing Grace");
  });
});
