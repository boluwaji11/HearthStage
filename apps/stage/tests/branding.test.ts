/**
 * STG-22, ST6.6. The church's mark, for the key that clears the room.
 *
 * The tests here are about what happens when the file is wrong, because that is
 * the part a church meets: a logo chosen off a desktop that was tidied in
 * March, a photograph picked by mistake, a file nobody can read. None of them
 * may put a broken image on a wall.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MOST_LOGO_BYTES,
  logoPath,
  readLogo,
  removeLogo,
  setLogo,
  typeOf,
} from "../src/main/branding";

let directory: string;
let chosen: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hearth-logo-"));
  chosen = mkdtempSync(join(tmpdir(), "hearth-chosen-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  rmSync(chosen, { recursive: true, force: true });
});

/** A file of the given name with something in it. The bytes do not matter. */
function file(name: string, bytes = 32): string {
  const path = join(chosen, name);
  writeFileSync(path, Buffer.alloc(bytes, 7));
  return path;
}

describe("choosing a mark", () => {
  it("keeps a copy, so tidying a desktop does not empty a screen", () => {
    expect(setLogo(directory, file("grace.png"))).toBeNull();
    expect(logoPath(directory)).toBe(join(directory, "logo.png"));
    rmSync(chosen, { recursive: true, force: true });
    expect(readLogo(directory)).toMatch(/^data:image\/png;base64,/);
  });

  it("refuses a file that is not a picture", () => {
    expect(setLogo(directory, file("accounts.pdf"))).toBe("type");
    expect(logoPath(directory)).toBeNull();
  });

  it("refuses one too big to hand a window", () => {
    expect(setLogo(directory, file("photo.jpg", MOST_LOGO_BYTES + 1))).toBe("size");
    expect(logoPath(directory)).toBeNull();
  });

  it("says so when it cannot read the file at all", () => {
    expect(setLogo(directory, join(chosen, "gone.png"))).toBe("unreadable");
  });

  it("holds one mark, whatever the last one was called", () => {
    setLogo(directory, file("old.png"));
    expect(setLogo(directory, file("new.svg"))).toBeNull();
    expect(existsSync(join(directory, "logo.png"))).toBe(false);
    expect(logoPath(directory)).toBe(join(directory, "logo.svg"));
  });

  it("reads the type from the name", () => {
    expect(typeOf("a/b/mark.SVG")).toBe("image/svg+xml");
    expect(typeOf("a/b/mark.jpeg")).toBe("image/jpeg");
    expect(typeOf("a/b/mark.exe")).toBeNull();
  });
});

describe("a church with no mark", () => {
  it("has none to read, and the key falls back to the ground", () => {
    expect(logoPath(directory)).toBeNull();
    expect(readLogo(directory)).toBeNull();
  });

  it("takes it away when asked, and says whether there was one", () => {
    expect(removeLogo(directory)).toBe(false);
    setLogo(directory, file("grace.png"));
    expect(removeLogo(directory)).toBe(true);
    expect(readLogo(directory)).toBeNull();
  });
});
