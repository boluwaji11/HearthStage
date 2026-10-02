/**
 * STG-6, ST2.1, ST2.5.
 *
 * The library on the laptop. For a church that never pairs with the platform,
 * this file is the only copy of its work, so the tests are about what happens
 * when something goes wrong rather than only about the happy path.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { amazingGrace, blankArrangement, blankSection, blankWholeSong, holyHolyHoly } from "@hearth/songs/fixtures";
import type { WholeSong } from "@hearth/songs";
import { LibraryError, openLibrary, type OpenLibrary } from "../src/index";

let directory: string;
let opened: OpenLibrary;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hearth-library-"));
  opened = openLibrary(join(directory, "library.db"), { backups: false });
});

afterEach(() => {
  opened.close();
  rmSync(directory, { recursive: true, force: true });
});

const local = (whole: WholeSong): WholeSong => ({
  ...whole,
  song: { ...whole.song, origin: "local" },
});

describe("opening a library", () => {
  it("creates it and runs the migrations", () => {
    expect(opened.migrated.from).toBe(0);
    expect(opened.migrated.to).toBe(1);
    expect(opened.migrated.applied).toEqual(["1: the library"]);
    expect(opened.library.count()).toBe(0);
  });

  it("opens an existing one without migrating again", () => {
    opened.close();
    const again = openLibrary(join(directory, "library.db"), { backups: false });
    expect(again.migrated.applied).toEqual([]);
    expect(again.migrated.to).toBe(1);
    again.close();
  });
});

describe("saving and reading a song", () => {
  it("round-trips a song whole", () => {
    opened.library.save(local(amazingGrace));
    const read = opened.library.get("song-amazing-grace");

    expect(read?.song.title).toBe("Amazing Grace");
    expect(read?.song.alternateTitles).toEqual(["Amazing Grace! How Sweet the Sound"]);
    expect(read?.song.themes).toEqual(["grace", "salvation", "assurance"]);
    expect(read?.song.isPublicDomain).toBe(true);
    expect(read?.song.year).toBe(1779);
    expect(read?.song.defaultKey).toBe("G");
  });

  it("keeps lyrics as lines, which is the whole point of the schema", () => {
    opened.library.save(local(amazingGrace));
    const read = opened.library.get("song-amazing-grace");
    const verse = read?.sections.find((section) => section.label === "V1");

    expect(verse?.lines).toEqual([
      "Amazing grace! how sweet the sound",
      "That saved a wretch like me!",
      "I once was lost, but now am found,",
      "Was blind, but now I see.",
    ]);
  });

  it("keeps the sequence as data and the chart as written", () => {
    opened.library.save(local(amazingGrace));
    const read = opened.library.get("song-amazing-grace");
    const arrangement = read?.arrangements.find((candidate) => candidate.name === "Sunday");

    expect(arrangement?.sequence).toEqual(["V1", "V2", "V3"]);
    expect(arrangement?.chordpro).toContain("A[G]mazing grace!");
    expect(arrangement?.isDefault).toBe(true);
  });

  it("keeps a section-aligned translation", () => {
    opened.library.save(local(amazingGrace));
    const spanish = opened.library
      .get("song-amazing-grace")
      ?.sections.find((section) => section.language === "es");
    expect(spanish?.translationOf).toBe("ag-v1");
  });

  it("returns null for a song that is not there", () => {
    expect(opened.library.get("never-existed")).toBeNull();
  });

  it("replaces sections and arrangements rather than piling them up", () => {
    opened.library.save(local(amazingGrace));
    const first = amazingGrace.arrangements[0];
    if (first === undefined) throw new Error("the fixture lost its arrangement");

    const trimmed: WholeSong = {
      ...local(amazingGrace),
      sections: amazingGrace.sections.slice(0, 1),
      arrangements: [{ ...first, sequence: ["V1"] }],
    };
    opened.library.save(trimmed);

    const read = opened.library.get("song-amazing-grace");
    expect(read?.sections).toHaveLength(1);
    expect(read?.arrangements).toHaveLength(1);
    expect(read?.arrangements[0]?.sequence).toEqual(["V1"]);
  });
});

describe("what it refuses to write", () => {
  it("refuses a song whose lyrics are a blob wearing an array", () => {
    // The guard on R12.4, now binding. A blob cannot reach the disk, so it
    // cannot reach Phase 2.
    const bad = blankWholeSong({
      sections: [blankSection({ lines: ["Line one\nLine two"] })],
    });
    expect(() => opened.library.save(local(bad))).toThrow(LibraryError);
    try {
      opened.library.save(local(bad));
    } catch (error) {
      expect((error as LibraryError).problems.map((problem) => problem.code)).toContain(
        "section.lines.containsNewline",
      );
    }
    expect(opened.library.count()).toBe(0);
  });

  it("refuses a sequence naming a section the song does not have", () => {
    const bad = blankWholeSong({
      sections: [blankSection({ label: "V1" })],
      arrangements: [blankArrangement({ sequence: ["V1", "C"] })],
    });
    expect(() => opened.library.save(local(bad))).toThrow(/cannot be saved/);
    expect(opened.library.count()).toBe(0);
  });

  it("refuses a synced song, because the library holds what Stage owns", () => {
    // PRD section 2. One writer per record, enforced by which file the
    // row would be in.
    const synced: WholeSong = {
      ...amazingGrace,
      song: { ...amazingGrace.song, origin: "hearth" },
    };
    expect(() => opened.library.save(synced)).toThrow(/belongs in the cache/);
    expect(opened.library.count()).toBe(0);
  });

  it("leaves the library untouched when a save is refused", () => {
    opened.library.save(local(amazingGrace));
    const before = opened.library.get("song-amazing-grace");

    const broken: WholeSong = {
      ...local(amazingGrace),
      sections: [blankSection({ songId: "song-amazing-grace", lines: [] })],
    };
    expect(() => opened.library.save(broken)).toThrow(LibraryError);

    // The transaction never opened, so last good version is still there.
    expect(opened.library.get("song-amazing-grace")).toEqual(before);
  });

  it("refuses two sections sharing a label, at the database as well", () => {
    // Belt and braces: the validator catches it, and the unique index means a
    // caller bypassing the validator still cannot write it.
    const duplicate = blankWholeSong({
      sections: [
        blankSection({ id: "a", label: "V1" }),
        blankSection({ id: "b", label: "V1", sortOrder: 1 }),
      ],
    });
    expect(() => opened.library.save(local(duplicate))).toThrow();
  });
});

describe("listing", () => {
  beforeEach(() => {
    opened.library.save(local(amazingGrace));
    opened.library.save(local(holyHolyHoly));
  });

  it("lists songs by title, with their counts", () => {
    const list = opened.library.list();
    expect(list.map((summary) => summary.title)).toEqual(["Amazing Grace", "Holy, Holy, Holy"]);
    expect(list[0]?.arrangementCount).toBe(2);
    expect(list[0]?.sectionCount).toBe(4);
    expect(list[1]?.arrangementCount).toBe(1);
  });

  it("returns every song whole, for an export", () => {
    const all = opened.library.all();
    expect(all).toHaveLength(2);
    expect(all[0]?.sections.length).toBeGreaterThan(0);
  });
});

describe("archiving (ST2.5)", () => {
  beforeEach(() => {
    opened.library.save(local(amazingGrace));
    opened.library.save(local(holyHolyHoly));
  });

  it("takes a song off the list and keeps the record", () => {
    // Archive rather than delete, which is the rule across the product.
    expect(opened.library.archive("song-holy")).toBe(true);
    expect(opened.library.list().map((summary) => summary.title)).toEqual(["Amazing Grace"]);
    expect(opened.library.count()).toBe(1);

    // Still whole, still readable.
    expect(opened.library.get("song-holy")?.sections).toHaveLength(2);
    expect(opened.library.isArchived("song-holy")).toBe(true);
  });

  it("shows archived songs when asked", () => {
    opened.library.archive("song-holy");
    expect(opened.library.list({ includeArchived: true })).toHaveLength(2);
    expect(opened.library.count({ includeArchived: true })).toBe(2);
  });

  it("restores one", () => {
    opened.library.archive("song-holy");
    expect(opened.library.restore("song-holy")).toBe(true);
    expect(opened.library.isArchived("song-holy")).toBe(false);
    expect(opened.library.list()).toHaveLength(2);
  });

  it("says nothing happened when it did not", () => {
    expect(opened.library.archive("not-a-song")).toBe(false);
    opened.library.archive("song-holy");
    expect(opened.library.archive("song-holy")).toBe(false);
  });

  it("keeps a song archived across a save, so editing one does not unarchive it", () => {
    opened.library.archive("song-holy");
    opened.library.save(local(holyHolyHoly));
    expect(opened.library.isArchived("song-holy")).toBe(true);
  });
});

describe("timestamps", () => {
  it("keeps the created date and moves the updated one", () => {
    let clock = "2026-10-01T10:00:00.000Z";
    const store = openLibrary(join(directory, "clocked.db"), {
      backups: false,
      now: () => clock,
    });

    store.library.save(local(amazingGrace));
    const created = store.db
      .prepare("SELECT created_at, updated_at FROM songs WHERE id = ?")
      .get("song-amazing-grace") as { created_at: string; updated_at: string };

    clock = "2026-10-08T10:00:00.000Z";
    store.library.save(local(amazingGrace));
    const edited = store.db
      .prepare("SELECT created_at, updated_at FROM songs WHERE id = ?")
      .get("song-amazing-grace") as { created_at: string; updated_at: string };

    expect(edited.created_at).toBe(created.created_at);
    expect(edited.updated_at).toBe("2026-10-08T10:00:00.000Z");
    store.close();
  });
});
