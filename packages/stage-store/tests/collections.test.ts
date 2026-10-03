/**
 * STG-150, ST2.18. A church's own grouping of its library.
 *
 * Two hundred presentations are not findable by a search box alone, because a
 * search box needs you to already know the name.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { amazingGrace, holyHolyHoly } from "@hearth/songs/fixtures";
import { openLibrary, type OpenLibrary } from "../src/index";

let directory: string;
let opened: OpenLibrary;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hearth-collections-"));
  opened = openLibrary(join(directory, "library.db"), { backups: false });
  opened.library.save(amazingGrace);
  opened.library.save(holyHolyHoly);
  opened.library.saveCollection({ id: "c1", name: "Christmas" });
  opened.library.saveCollection({ id: "c2", name: "Communion" });
});

afterEach(() => {
  opened.close();
  rmSync(directory, { recursive: true, force: true });
});

describe("keeping collections", () => {
  it("lists them in order, with how much is in each", () => {
    expect(opened.library.collections()).toEqual([
      { id: "c1", name: "Christmas", sortOrder: 0, items: 0 },
      { id: "c2", name: "Communion", sortOrder: 0, items: 0 },
    ]);
  });

  it("renames one without emptying it", () => {
    opened.library.setInCollection("c1", amazingGrace.song.id, true);
    opened.library.saveCollection({ id: "c1", name: "Advent" });
    expect(opened.library.collections()[0]).toMatchObject({ name: "Advent", items: 1 });
  });

  it("takes an order a church put them in", () => {
    opened.library.saveCollection({ id: "c2", name: "Communion", sortOrder: -1 });
    expect(opened.library.collections().map((one) => one.name)).toEqual([
      "Communion",
      "Christmas",
    ]);
  });

  it("trims a name somebody typed with a space on the end", () => {
    opened.library.saveCollection({ id: "c3", name: "  Easter  " });
    expect(opened.library.collections().find((one) => one.id === "c3")?.name).toBe("Easter");
  });
});

describe("what is in a collection", () => {
  it("holds a song that was put in it", () => {
    opened.library.setInCollection("c1", amazingGrace.song.id, true);
    expect(opened.library.itemsInCollection("c1")).toEqual([amazingGrace.song.id]);
    expect(opened.library.collectionsOf(amazingGrace.song.id)).toEqual(["c1"]);
  });

  it("holds one item in several collections", () => {
    opened.library.setInCollection("c1", amazingGrace.song.id, true);
    opened.library.setInCollection("c2", amazingGrace.song.id, true);
    expect(opened.library.collectionsOf(amazingGrace.song.id)).toEqual(["c1", "c2"]);
  });

  it("says the same thing twice without counting it twice", () => {
    opened.library.setInCollection("c1", amazingGrace.song.id, true);
    opened.library.setInCollection("c1", amazingGrace.song.id, true);
    expect(opened.library.itemsInCollection("c1")).toHaveLength(1);
  });

  it("takes an item out, and takes out what is not in it without complaint", () => {
    opened.library.setInCollection("c1", amazingGrace.song.id, true);
    opened.library.setInCollection("c1", amazingGrace.song.id, false);
    opened.library.setInCollection("c1", holyHolyHoly.song.id, false);
    expect(opened.library.itemsInCollection("c1")).toEqual([]);
  });

  it("keeps an item that was archived, so the collection still reads as one", () => {
    opened.library.setInCollection("c1", amazingGrace.song.id, true);
    opened.library.archive(amazingGrace.song.id);
    expect(opened.library.itemsInCollection("c1")).toEqual([amazingGrace.song.id]);
  });
});

describe("taking a collection off the list", () => {
  beforeEach(() => {
    opened.library.setInCollection("c1", amazingGrace.song.id, true);
  });

  it("takes it off", () => {
    expect(opened.library.archiveCollection("c1")).toBe(true);
    expect(opened.library.collections().map((one) => one.id)).toEqual(["c2"]);
  });

  it("leaves the songs alone, because a grouping is not the things grouped", () => {
    opened.library.archiveCollection("c1");
    expect(opened.library.get(amazingGrace.song.id)).not.toBeNull();
  });

  it("stops naming it on the song", () => {
    opened.library.archiveCollection("c1");
    expect(opened.library.collectionsOf(amazingGrace.song.id)).toEqual([]);
  });

  it("says nothing happened the second time", () => {
    opened.library.archiveCollection("c1");
    expect(opened.library.archiveCollection("c1")).toBe(false);
  });
});
