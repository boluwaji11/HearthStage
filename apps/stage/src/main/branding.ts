/**
 * STG-22, ST6.6. The church's logo, for the key that clears the room.
 *
 * Black, clear and logo are the three things an operator does between items.
 * Black kills the screen, clear leaves the ground, and logo puts the church's
 * own mark up, which is what a room looks at for the ten minutes before a
 * service starts.
 *
 * **It is the church's mark rather than ours.** Nothing ships a default. A
 * screen at the front of somebody's building is not a place to put our name,
 * and a church with no logo gets the ground, which is what the key did before.
 *
 * **It is copied in rather than linked to.** A church that chooses a file off a
 * desktop and tidies the desktop in March should not find a blank screen in
 * April, and a path into a folder that syncs is a file that can be gone at
 * 10:28.
 */

import { copyFileSync, existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/** What a logo may be. Anything a window can draw from a data URL. */
export const LOGO_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/** Larger than any mark, and small enough to hand a window in one message. */
export const MOST_LOGO_BYTES = 4 * 1024 * 1024;

export type LogoRefusal = "type" | "size" | "unreadable";

export function typeOf(path: string): string | null {
  return LOGO_TYPES[extname(path).toLowerCase()] ?? null;
}

function pathsIn(directory: string): string[] {
  return Object.keys(LOGO_TYPES).map((extension) => join(directory, `logo${extension}`));
}

/** The logo file a church has, where they have one. */
export function logoPath(directory: string): string | null {
  return pathsIn(directory).find((path) => existsSync(path)) ?? null;
}

/**
 * The logo as a window can draw it, or null where there is none.
 *
 * A data URL rather than a path, because the windows are sandboxed and their
 * policy allows `data:` and nothing else off the disk. Read once and held by
 * the caller, so it is not on the wire behind every keypress.
 */
export function readLogo(directory: string): string | null {
  const path = logoPath(directory);
  if (path === null) return null;
  const type = typeOf(path);
  if (type === null) return null;

  try {
    const bytes = readFileSync(path);
    if (bytes.byteLength > MOST_LOGO_BYTES) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    // A file that will not read is a file the church no longer has. The key
    // falls back to the ground rather than putting a broken image on a wall.
    return null;
  }
}

/**
 * Takes a church's file and keeps a copy.
 *
 * Returns what is wrong where it refused, so the window can say which of the
 * two it was rather than saying nothing happened.
 */
export function setLogo(directory: string, from: string): LogoRefusal | null {
  const type = typeOf(from);
  if (type === null) return "type";

  try {
    if (statSync(from).size > MOST_LOGO_BYTES) return "size";
    // One logo. The old one goes, whatever it was called, so two files cannot
    // both claim to be the mark.
    removeLogo(directory);
    copyFileSync(from, join(directory, `logo${extname(from).toLowerCase()}`));
    return null;
  } catch {
    return "unreadable";
  }
}

/** Takes the logo away. The key falls back to the ground. */
export function removeLogo(directory: string): boolean {
  let gone = false;
  for (const path of pathsIn(directory)) {
    if (!existsSync(path)) continue;
    rmSync(path, { force: true });
    gone = true;
  }
  return gone;
}
