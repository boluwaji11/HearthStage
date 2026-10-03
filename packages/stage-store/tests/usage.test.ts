/**
 * STG-52, ST2.10, ST18.7. The log a CCLI report is built out of.
 *
 * A small church gets fined for failing that report, so this is the record the
 * fine turns on. The rules worth defending: a row is written when a song is
 * shown rather than when a plan is opened, one service is one use however many
 * times the operator goes back to the chorus, and the log outlives the song.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { amazingGrace, holyHolyHoly } from "@hearth/songs/fixtures";
import { openLibrary, type OpenLibrary, type SongUse } from "../src/index";

let directory: string;
let opened: OpenLibrary;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hearth-usage-"));
  opened = openLibrary(join(directory, "library.db"), { backups: false });
  opened.library.save(amazingGrace);
  opened.library.save(holyHolyHoly);
});

afterEach(() => {
  opened.close();
  rmSync(directory, { recursive: true, force: true });
});

function use(partial: Partial<SongUse> = {}): SongUse {
  return {
    songId: amazingGrace.song.id,
    title: amazingGrace.song.title,
    ccliNumber: "22025",
    serviceDate: "2026-10-04",
    setListId: "set-1",
    setListTitle: "Morning Service",
    arrangementId: "arr-1",
    key: "G",
    shownAt: "2026-10-04T10:12:00Z",
    ...partial,
  };
}

describe("writing a use", () => {
  it("keeps what the report has to say", () => {
    expect(opened.library.logUsage(use())).toBe(true);
    expect(opened.library.usage()).toEqual([
      {
        songId: amazingGrace.song.id,
        title: amazingGrace.song.title,
        author: null,
        ccliNumber: "22025",
        serviceDate: "2026-10-04",
        setListId: "set-1",
        setListTitle: "Morning Service",
        arrangementId: "arr-1",
        key: "G",
        shownAt: "2026-10-04T10:12:00Z",
      },
    ]);
  });

  it("counts one service once, however often the chorus comes back", () => {
    expect(opened.library.logUsage(use())).toBe(true);
    expect(opened.library.logUsage(use())).toBe(false);
    expect(opened.library.logUsage(use({ key: "A", shownAt: "2026-10-04T10:40:00Z" }))).toBe(false);
    expect(opened.library.usage()).toHaveLength(1);
  });

  it("counts the same song again on another service", () => {
    opened.library.logUsage(use());
    opened.library.logUsage(use({ serviceDate: "2026-10-11", setListId: "set-2" }));
    expect(opened.library.usage()).toHaveLength(2);
  });

  it("counts a second service on the same day", () => {
    opened.library.logUsage(use({ setListId: "morning" }));
    opened.library.logUsage(use({ setListId: "evening" }));
    expect(opened.library.usage()).toHaveLength(2);
  });

  it("counts a song shown with no plan open", () => {
    opened.library.logUsage(use({ setListId: null, setListTitle: null }));
    expect(opened.library.logUsage(use({ setListId: null, setListTitle: null }))).toBe(false);
    expect(opened.library.usage()).toHaveLength(1);
  });

  it("moves the song's last used date, which the library sorts on", () => {
    opened.library.logUsage(use());
    expect(opened.library.get(amazingGrace.song.id)?.song.lastUsedAt).toBe("2026-10-04T10:12:00Z");
  });
});

describe("reading the log back", () => {
  beforeEach(() => {
    opened.library.logUsage(use({ serviceDate: "2026-01-04", setListId: "a" }));
    opened.library.logUsage(use({ serviceDate: "2026-06-28", setListId: "b" }));
    opened.library.logUsage(use({ serviceDate: "2026-07-05", setListId: "c" }));
  });

  it("takes a period with both ends in it", () => {
    const found = opened.library.usage({ from: "2026-01-01", to: "2026-06-30" });
    expect(found.map((row) => row.serviceDate)).toEqual(["2026-01-04", "2026-06-28"]);
  });

  it("takes the whole of the last day, because June means June", () => {
    expect(opened.library.usage({ from: "2026-06-28", to: "2026-06-28" })).toHaveLength(1);
  });

  it("reads in date order, which is the order a report reads in", () => {
    expect(opened.library.usage().map((row) => row.serviceDate)).toEqual([
      "2026-01-04",
      "2026-06-28",
      "2026-07-05",
    ]);
  });

  it("outlives the song, because last February still has to be reported", () => {
    opened.library.archive(amazingGrace.song.id);
    expect(opened.library.usage()).toHaveLength(3);
    expect(opened.library.usage()[0]?.title).toBe(amazingGrace.song.title);
  });
});
