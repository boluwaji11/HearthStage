/**
 * STG-151, ST9.10. The media library, on disk.
 *
 * The file side: what Stage takes, where the copy goes, and the one check that
 * keeps a sandboxed window from reading the rest of the laptop.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import {
  addMedia,
  hashOf,
  MEDIA_EXTENSIONS,
  mediaDirectory,
  nameFrom,
  removeMedia,
  typeOf,
  within,
} from "../src/main/media";

let profile: string;
let source: string;

beforeEach(() => {
  profile = mkdtempSync(join(tmpdir(), "hearth-profile-"));
  source = mkdtempSync(join(tmpdir(), "hearth-pictures-"));
});

afterEach(() => {
  rmSync(profile, { recursive: true, force: true });
  rmSync(source, { recursive: true, force: true });
});

function picture(name: string, contents = "a picture"): string {
  const path = join(source, name);
  writeFileSync(path, contents);
  return path;
}

describe("what Stage takes", () => {
  it("knows an image, a video and a sound apart", () => {
    expect(typeOf("/x/autumn.JPG")).toEqual({ kind: "image", mime: "image/jpeg" });
    expect(typeOf("/x/loop.mp4")).toEqual({ kind: "video", mime: "video/mp4" });
    expect(typeOf("/x/bed.mp3")).toEqual({ kind: "audio", mime: "audio/mpeg" });
  });

  it("refuses what the window at the back of the hall could not play", () => {
    expect(typeOf("/x/slides.key")).toBeNull();
    expect(typeOf("/x/loop.mov")).toBeNull();
    expect(addMedia(profile, "m1", picture("notes.txt"))).toBe("type");
  });

  it("offers every extension it takes to the file dialog, without the dot", () => {
    expect(MEDIA_EXTENSIONS).toContain("png");
    expect(MEDIA_EXTENSIONS).toContain("mp4");
    expect(MEDIA_EXTENSIONS.every((one) => !one.startsWith("."))).toBe(true);
  });
});

describe("adding one", () => {
  it("copies it in, so tidying the folder it came from changes nothing", () => {
    const from = picture("autumn.jpg");
    const added = addMedia(profile, "m1", from);
    expect(added).toMatchObject({ kind: "image", mime: "image/jpeg", file: "m1.jpg" });

    rmSync(from);
    expect(readFileSync(join(mediaDirectory(profile), "m1.jpg"), "utf8")).toBe("a picture");
  });

  it("names the copy by id, so two files called background are two files", () => {
    const one = addMedia(profile, "m1", picture("background.jpg", "one"));
    const two = addMedia(profile, "m2", picture("background.jpg", "two"));
    expect(one).not.toEqual(two);
    expect(existsSync(join(mediaDirectory(profile), "m1.jpg"))).toBe(true);
    expect(existsSync(join(mediaDirectory(profile), "m2.jpg"))).toBe(true);
  });

  it("carries the content hash STG-152 will reference it by", () => {
    const added = addMedia(profile, "m1", picture("autumn.jpg"));
    if (typeof added === "string") throw new Error(added);
    expect(added.hash).toBe(hashOf(join(mediaDirectory(profile), "m1.jpg")));
    expect(added.hash).toHaveLength(64);
  });

  it("says a file it cannot read was unreadable, rather than saying nothing", () => {
    expect(addMedia(profile, "m1", join(source, "gone.jpg"))).toBe("unreadable");
  });

  it("suggests a name a church would recognise", () => {
    expect(nameFrom("/x/autumn-field_wide.jpg")).toBe("autumn field wide");
    expect(nameFrom("/x/Communion.MP4")).toBe("Communion");
  });
});

describe("the folder a window may read", () => {
  it("resolves a name inside it", () => {
    expect(within(profile, "m1.jpg")).toBe(join(mediaDirectory(profile), "m1.jpg"));
  });

  it("refuses a way out of it, which is the first thing anybody tries", () => {
    expect(within(profile, `..${sep}library.db`)).toBeNull();
    expect(within(profile, `..${sep}..${sep}etc${sep}passwd`)).toBeNull();
    expect(within(profile, "/etc/passwd")).toBeNull();
  });

  it("removes a copy once, and reports the second attempt honestly", () => {
    addMedia(profile, "m1", picture("autumn.jpg"));
    expect(removeMedia(profile, "m1.jpg")).toBe(true);
    expect(removeMedia(profile, "m1.jpg")).toBe(false);
  });

  it("will not remove anything outside the folder", () => {
    const outside = picture("keep.jpg");
    expect(removeMedia(profile, `..${sep}..${sep}${outside}`)).toBe(false);
    expect(existsSync(outside)).toBe(true);
  });
});
