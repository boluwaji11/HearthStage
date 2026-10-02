/**
 * STG-6, ST19.5.
 *
 * The acceptance criterion reads: deleting the library database and restoring
 * from the automatic backup returns every song, arrangement, set list and usage
 * row. Set lists and usage arrive with STG-46 and STG-52, so the test covers
 * what exists and will grow with them.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { amazingGrace, holyHolyHoly } from "@hearth/songs/fixtures";
import type { WholeSong } from "@hearth/songs";
import { backup, backups, isUsable, openLibrary, restore, type OpenLibrary } from "../src/index";

let directory: string;
let path: string;
let opened: OpenLibrary;

const local = (whole: WholeSong): WholeSong => ({
  ...whole,
  song: { ...whole.song, origin: "local" },
});

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hearth-backup-"));
  path = join(directory, "library.db");
  opened = openLibrary(path, { backups: false });
});

afterEach(() => {
  try {
    opened.close();
  } catch {
    // Already closed by a test that was checking what happens afterwards.
  }
  rmSync(directory, { recursive: true, force: true });
});

describe("taking a backup", () => {
  it("writes one, and says how big it is", async () => {
    opened.library.save(local(amazingGrace));
    const info = await backup(opened.db, path);

    expect(existsSync(info.path)).toBe(true);
    expect(info.bytes).toBeGreaterThan(0);
    expect(isUsable(info.path)).toBe(true);
  });

  it("rotates generations, newest first", async () => {
    opened.library.save(local(amazingGrace));
    await backup(opened.db, path, { generations: 3 });

    opened.library.save(local(holyHolyHoly));
    await backup(opened.db, path, { generations: 3 });

    const found = backups(path, { generations: 3 });
    expect(found).toHaveLength(2);

    // The newest has both songs, the one behind it has one.
    const newest = openLibrary(found[0]?.path ?? "", { backups: false });
    expect(newest.library.count()).toBe(2);
    newest.close();

    const previous = openLibrary(found[1]?.path ?? "", { backups: false });
    expect(previous.library.count()).toBe(1);
    previous.close();
  });

  it("keeps only as many generations as asked for", async () => {
    opened.library.save(local(amazingGrace));
    for (let round = 0; round < 6; round += 1) {
      await backup(opened.db, path, { generations: 3 });
    }
    expect(backups(path, { generations: 3 })).toHaveLength(3);
  });

  it("happens on every write when the library is opened normally", async () => {
    const live = openLibrary(join(directory, "live.db"), { generations: 2 });
    live.library.save(local(amazingGrace));
    // The backup is fired after the write commits and does not block it.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(backups(join(directory, "live.db"), { generations: 2 }).length).toBeGreaterThan(0);
    live.close();
  });
});

describe("restoring", () => {
  it("brings back every song after the library is deleted", async () => {
    opened.library.save(local(amazingGrace));
    opened.library.save(local(holyHolyHoly));
    const info = await backup(opened.db, path);
    opened.close();

    // The laptop's disk went, or somebody deleted the wrong thing.
    rmSync(path);
    rmSync(`${path}-wal`, { force: true });
    rmSync(`${path}-shm`, { force: true });
    expect(existsSync(path)).toBe(false);

    restore(path, info.path);

    const recovered = openLibrary(path, { backups: false });
    expect(recovered.library.count()).toBe(2);

    const song = recovered.library.get("song-amazing-grace");
    expect(song?.sections).toHaveLength(4);
    expect(song?.arrangements).toHaveLength(2);
    expect(song?.sections.find((section) => section.label === "V1")?.lines).toHaveLength(4);
    expect(song?.arrangements.find((a) => a.name === "Sunday")?.chordpro).toContain("[G]");
    recovered.close();
    opened = recovered;
  });

  it("moves the file it replaces aside rather than deleting it", async () => {
    opened.library.save(local(amazingGrace));
    const info = await backup(opened.db, path);
    opened.library.save(local(holyHolyHoly));
    opened.close();

    const result = restore(path, info.path);

    // Somebody restoring a backup is already having a bad day, and a mistaken
    // restore should not be the end of it.
    expect(result.movedAside).not.toBeNull();
    expect(existsSync(result.movedAside ?? "")).toBe(true);

    const back = openLibrary(path, { backups: false });
    expect(back.library.count()).toBe(1);
    back.close();
    opened = back;
  });

  it("refuses a file that is not a library", () => {
    const rubbish = join(directory, "holiday-photo.db");
    writeFileSync(rubbish, "this is not a database");
    expect(isUsable(rubbish)).toBe(false);
    expect(() => restore(path, rubbish)).toThrow(/not a library/);
  });

  it("refuses a file that is not there", () => {
    expect(isUsable(join(directory, "absent.db"))).toBe(false);
    expect(() => restore(path, join(directory, "absent.db"))).toThrow(/not a library/);
  });
});
