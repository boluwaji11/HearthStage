/**
 * STG-151, ST9.10. The media shelf.
 *
 * Images, video loops and audio a church adds once and uses anywhere.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openLibrary, type OpenLibrary } from "../src/index";

let directory: string;
let opened: OpenLibrary;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hearth-media-"));
  opened = openLibrary(join(directory, "library.db"), { backups: false });
});

afterEach(() => {
  opened.close();
  rmSync(directory, { recursive: true, force: true });
});

function add(id: string, over: Partial<Parameters<OpenLibrary["library"]["saveMedia"]>[0]> = {}) {
  opened.library.saveMedia({
    id,
    kind: "image",
    name: id,
    file: `${id}.jpg`,
    mime: "image/jpeg",
    bytes: 1024,
    ...over,
  });
}

describe("the media shelf", () => {
  it("keeps what a church added, with the file it was copied to", () => {
    add("m1", { name: "Autumn field", hash: "abc" });
    const [row] = opened.library.media();
    expect(row).toMatchObject({
      id: "m1",
      kind: "image",
      name: "Autumn field",
      file: "m1.jpg",
      mime: "image/jpeg",
      bytes: 1024,
      hash: "abc",
    });
  });

  it("lists the newest first, because the last thing added is the one wanted", () => {
    const at = ["2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z"];
    let step = 0;
    const library = openLibrary(join(directory, "ordered.db"), {
      backups: false,
      now: () => at[step] ?? at[1]!,
    });
    library.library.saveMedia({
      id: "older",
      kind: "image",
      name: "Older",
      file: "older.jpg",
      mime: "image/jpeg",
      bytes: 1,
    });
    step = 1;
    library.library.saveMedia({
      id: "newer",
      kind: "video",
      name: "Newer",
      file: "newer.mp4",
      mime: "video/mp4",
      bytes: 2,
    });
    expect(library.library.media().map((one) => one.id)).toEqual(["newer", "older"]);
    library.close();
  });

  it("narrows to one kind, because a loop and a photograph are looked for apart", () => {
    add("m1");
    add("m2", { kind: "video", file: "m2.mp4", mime: "video/mp4" });
    add("m3", { kind: "audio", file: "m3.mp3", mime: "audio/mpeg" });
    expect(opened.library.media({ kind: "video" }).map((one) => one.id)).toEqual(["m2"]);
    expect(opened.library.countMedia()).toBe(3);
  });

  it("renames without touching the file, which keeps its own name", () => {
    add("m1", { name: "DSC 0041" });
    expect(opened.library.renameMedia("m1", "  Communion table  ")).toBe(true);
    const row = opened.library.getMedia("m1");
    expect(row?.name).toBe("Communion table");
    expect(row?.file).toBe("m1.jpg");
  });

  it("refuses a blank name, because a tile with no words is a tile nobody can find", () => {
    add("m1", { name: "Keeps this" });
    expect(opened.library.renameMedia("m1", "   ")).toBe(false);
    expect(opened.library.getMedia("m1")?.name).toBe("Keeps this");
  });

  it("takes one off the shelf, and says so only the first time", () => {
    add("m1");
    expect(opened.library.archiveMedia("m1")).toBe(true);
    expect(opened.library.archiveMedia("m1")).toBe(false);
    expect(opened.library.media()).toEqual([]);
    expect(opened.library.media({ includeArchived: true })).toHaveLength(1);
  });

  it("saving the same id again keeps when it was added", () => {
    add("m1", { name: "First" });
    const first = opened.library.getMedia("m1");
    add("m1", { name: "Second" });
    const again = opened.library.getMedia("m1");
    expect(again?.createdAt).toBe(first?.createdAt);
    expect(again?.name).toBe("Second");
  });
});

/** STG-152, ST9.11. The hash is what a file is. */
describe("one row per file", () => {
  it("finds a file by its contents, which is how a reference resolves", () => {
    add("m1", { hash: "deadbeef" });
    expect(opened.library.mediaByHash("deadbeef")?.id).toBe("m1");
    expect(opened.library.mediaByHash("nothing")).toBeNull();
  });

  it("answers for one taken off the shelf, so adding it again puts it back", () => {
    add("m1", { hash: "deadbeef" });
    opened.library.archiveMedia("m1");
    expect(opened.library.mediaByHash("deadbeef")?.id).toBe("m1");
    expect(opened.library.restoreMedia("m1")).toBe(true);
    expect(opened.library.restoreMedia("m1")).toBe(false);
    expect(opened.library.media()).toHaveLength(1);
  });

  it("refuses a second row for the same bytes", () => {
    add("m1", { hash: "deadbeef" });
    expect(() => add("m2", { hash: "deadbeef" })).toThrow();
  });

  it("lets rows written before the hash was the identity sit without one", () => {
    add("m1");
    add("m2");
    expect(opened.library.mediaWithoutHash().map((one) => one.id).sort()).toEqual(["m1", "m2"]);
    opened.library.saveMedia({
      id: "m1",
      kind: "image",
      name: "m1",
      file: "m1.jpg",
      mime: "image/jpeg",
      bytes: 1024,
      hash: "filled in",
    });
    expect(opened.library.mediaWithoutHash().map((one) => one.id)).toEqual(["m2"]);
  });
});
