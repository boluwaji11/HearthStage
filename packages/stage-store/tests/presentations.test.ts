/**
 * STG-145, ST2.16. Slides on the disk.
 *
 * Same two invariants the song side has, checked here because the store is the
 * last place a bad presentation can be stopped: validated before the write, and
 * `local` only.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newPresentation, parseSlides, type Presentation } from "@hearth/songs";
import { amazingGrace } from "@hearth/songs/fixtures";
import { LibraryError, openLibrary, type OpenLibrary } from "../src/index";

const OUTLINE = `[Point 1]
God speaks first

[Point 2]
We answer

[Point 3]
Then we go`;

function outline(id = "p1", title = "Sermon outline"): Presentation {
  return {
    ...newPresentation(id, { title }),
    slides: parseSlides(OUTLINE, { presentationId: id }),
  };
}

let directory: string;
let opened: OpenLibrary;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hearth-presentations-"));
  opened = openLibrary(join(directory, "library.db"), { backups: false });
});

afterEach(() => {
  opened.close();
  rmSync(directory, { recursive: true, force: true });
});

describe("saving a presentation", () => {
  it("comes back whole, with its slides in order", () => {
    opened.library.savePresentation(outline());
    const back = opened.library.getPresentation("p1");

    expect(back?.title).toBe("Sermon outline");
    expect(back?.kind).toBe("plain");
    expect(back?.slides).toHaveLength(3);
    expect(back?.slides.map((slide) => slide.label)).toEqual(["Point 1", "Point 2", "Point 3"]);
    expect(back?.slides[1]?.lines).toEqual(["We answer"]);
  });

  it("replaces the slides rather than merging them", () => {
    opened.library.savePresentation(outline());
    opened.library.savePresentation({
      ...outline(),
      slides: parseSlides("Only this one", { presentationId: "p1" }),
    });
    expect(opened.library.getPresentation("p1")?.slides).toHaveLength(1);
  });

  it("refuses one with no title and says why", () => {
    expect(() => opened.library.savePresentation(outline("p1", " "))).toThrow(LibraryError);
    try {
      opened.library.savePresentation(outline("p1", " "));
    } catch (error) {
      expect((error as LibraryError).problems.map((problem) => problem.code)).toEqual([
        "title.missing",
      ]);
    }
    expect(opened.library.getPresentation("p1")).toBeNull();
  });

  it("keeps one that is named and not yet filled", () => {
    opened.library.savePresentation(newPresentation("p2", { title: "Empty" }));
    expect(opened.library.getPresentation("p2")?.slides).toEqual([]);
    expect(opened.library.listPresentations()[0]?.slideCount).toBe(0);
  });

  it("refuses a synced one, because the cache holds what the platform owns", () => {
    expect(() =>
      opened.library.savePresentation({ ...outline(), origin: "hearth" }),
    ).toThrow(/cache/);
  });

  it("writes nothing on a refusal, so a failed save cannot half land", () => {
    opened.library.savePresentation(outline());
    const broken = { ...outline(), title: "" };
    expect(() => opened.library.savePresentation(broken)).toThrow(LibraryError);
    expect(opened.library.getPresentation("p1")?.title).toBe("Sermon outline");
    expect(opened.library.getPresentation("p1")?.slides).toHaveLength(3);
  });
});

describe("the list", () => {
  it("counts the slides the room will see", () => {
    opened.library.savePresentation(outline());
    const [row] = opened.library.listPresentations();
    expect(row?.slideCount).toBe(3);
    expect(row?.origin).toBe("local");
  });

  it("puts the most recently changed first, because that is what is being worked on", () => {
    let clock = 0;
    const stamps = ["2026-10-01T09:00:00Z", "2026-10-01T10:00:00Z"];
    opened.close();
    const again = openLibrary(join(directory, "library.db"), {
      backups: false,
      now: () => stamps[clock++] ?? "2026-10-01T11:00:00Z",
    });
    again.library.savePresentation(outline("first", "First"));
    again.library.savePresentation(outline("second", "Second"));
    expect(again.library.listPresentations().map((row) => row.id)).toEqual(["second", "first"]);
    again.close();
    opened = again;
  });

  it("leaves an archived one out, and keeps it", () => {
    opened.library.savePresentation(outline());
    expect(opened.library.archivePresentation("p1")).toBe(true);
    expect(opened.library.listPresentations()).toEqual([]);
    expect(opened.library.countPresentations()).toBe(0);
    expect(opened.library.getPresentation("p1")?.slides).toHaveLength(3);
    expect(opened.library.listPresentations({ includeArchived: true })).toHaveLength(1);
  });

  it("brings an archived one back", () => {
    opened.library.savePresentation(outline());
    opened.library.archivePresentation("p1");
    expect(opened.library.restorePresentation("p1")).toBe(true);
    expect(opened.library.countPresentations()).toBe(1);
  });

  it("keeps the archive flag through a save, so editing does not unhide it", () => {
    opened.library.savePresentation(outline());
    opened.library.archivePresentation("p1");
    opened.library.savePresentation({ ...outline(), title: "Changed" });
    expect(opened.library.listPresentations()).toEqual([]);
  });

  it("hands the deck compiler every presentation whole", () => {
    opened.library.savePresentation(outline("a", "A"));
    opened.library.savePresentation(outline("b", "B"));
    const all = opened.library.allPresentations();
    expect(all).toHaveLength(2);
    expect(all.every((one) => one.slides.length === 3)).toBe(true);
  });
});

describe("presentations and songs in one file", () => {
  it("do not disturb each other", () => {
    opened.library.savePresentation(outline());
    expect(opened.library.count()).toBe(0);
    expect(opened.library.countPresentations()).toBe(1);
  });
});

describe("the library as one list", () => {
  beforeEach(() => {
    opened.library.save(amazingGrace);
    opened.library.savePresentation(outline("p1", "Sermon outline"));
    opened.library.savePresentation(outline("p2", "Notices"));
  });

  it("holds songs and typed slides together, each saying which it is", () => {
    const items = opened.library.items();
    expect(items.map((item) => [item.kind, item.title])).toEqual([
      ["song", "Amazing Grace"],
      ["plain", "Notices"],
      ["plain", "Sermon outline"],
    ]);
  });

  it("counts sections on a song and slides on a presentation", () => {
    const items = opened.library.items();
    expect(items.find((item) => item.kind === "song")?.count).toBe(amazingGrace.sections.length);
    expect(items.find((item) => item.title === "Notices")?.count).toBe(3);
  });

  it("carries the author on a song, for the second line of the row", () => {
    expect(opened.library.items()[0]?.subtitle).toBe("John Newton");
    expect(opened.library.items()[1]?.subtitle).toBeNull();
  });

  it("sorts by title across both, so the list reads as one", () => {
    opened.library.savePresentation(outline("p3", "Aaron"));
    expect(opened.library.items()[0]?.title).toBe("Aaron");
  });

  it("leaves archived rows out of both halves", () => {
    opened.library.archive(amazingGrace.song.id);
    opened.library.archivePresentation("p1");
    expect(opened.library.items().map((item) => item.title)).toEqual(["Notices"]);
    expect(opened.library.items({ includeArchived: true })).toHaveLength(3);
  });

  it("carries the origin, which is who may write the row", () => {
    expect(opened.library.items().every((item) => item.origin === "local")).toBe(true);
  });
});
