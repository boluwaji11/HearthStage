/**
 * STG-151, ST9.10. The media library, on disk.
 *
 * Images, video loops and audio a church adds once and uses anywhere. This
 * module owns the files; `Library.saveMedia` owns the rows.
 *
 * **Copied in rather than linked to**, for the reason the logo is (branding.ts):
 * a church that picks a photograph out of a download folder and tidies that
 * folder in March should not find a black screen in April, and a path into a
 * folder that syncs is a file that can be gone at 10:28.
 *
 * **Named by id rather than by what the church called it.** Two files called
 * `background.jpg` are two files, a name with a slash in it is a path, and a
 * name in an alphabet the filesystem normalises is a name that changes under
 * us. What the church calls it is a column, and renaming it never touches disk.
 */

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

import type { MediaFileKind } from "@hearth/stage-store";

/**
 * What Stage takes, and what each thing is.
 *
 * Deliberately short. Every one of these decodes in Chromium on all three
 * operating systems without a codec a church has to install, which is the whole
 * test: a format that plays on the developer's laptop and not on the one at the
 * back of the hall is worse than a format we refused.
 */
export const MEDIA_TYPES: Record<string, { kind: MediaFileKind; mime: string }> = {
  ".png": { kind: "image", mime: "image/png" },
  ".jpg": { kind: "image", mime: "image/jpeg" },
  ".jpeg": { kind: "image", mime: "image/jpeg" },
  ".webp": { kind: "image", mime: "image/webp" },
  ".gif": { kind: "image", mime: "image/gif" },
  ".svg": { kind: "image", mime: "image/svg+xml" },
  ".mp4": { kind: "video", mime: "video/mp4" },
  ".webm": { kind: "video", mime: "video/webm" },
  ".m4v": { kind: "video", mime: "video/mp4" },
  ".mp3": { kind: "audio", mime: "audio/mpeg" },
  ".m4a": { kind: "audio", mime: "audio/mp4" },
  ".wav": { kind: "audio", mime: "audio/wav" },
  ".ogg": { kind: "audio", mime: "audio/ogg" },
};

/** Every extension the file dialog offers, without the dot. */
export const MEDIA_EXTENSIONS = Object.keys(MEDIA_TYPES).map((extension) => extension.slice(1));

/**
 * Two gigabytes.
 *
 * Generous, because a ten minute loop at a sensible bitrate is large and a
 * church that cannot add its own video has no media library. The profile is the
 * church's own disk, so the limit is here to catch a mistake rather than to
 * ration anything.
 */
export const MOST_MEDIA_BYTES = 2 * 1024 * 1024 * 1024;

export type MediaRefusal = "type" | "size" | "unreadable";

/** Where the copies live, under the profile. */
export function mediaDirectory(profile: string): string {
  return join(profile, "media");
}

export function typeOf(path: string): { kind: MediaFileKind; mime: string } | null {
  return MEDIA_TYPES[extname(path).toLowerCase()] ?? null;
}

/** What a church sees before it renames anything: the file, without the dot. */
export function nameFrom(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return stem.replace(/[_-]+/g, " ").trim() || base;
}

export interface Added {
  kind: MediaFileKind;
  mime: string;
  /** The name inside the media folder. */
  file: string;
  bytes: number;
  hash: string;
}

/**
 * Copies a church's file in, and says what it now holds.
 *
 * Returns the refusal where it refused, so the window can say which of the
 * three it was rather than saying nothing happened.
 */
export function addMedia(profile: string, id: string, from: string): Added | MediaRefusal {
  const type = typeOf(from);
  if (type === null) return "type";

  try {
    const bytes = statSync(from).size;
    if (bytes > MOST_MEDIA_BYTES) return "size";

    const directory = mediaDirectory(profile);
    mkdirSync(directory, { recursive: true });
    const file = `${id}${extname(from).toLowerCase()}`;
    copyFileSync(from, join(directory, file));

    return { kind: type.kind, mime: type.mime, file, bytes, hash: hashOf(join(directory, file)) };
  } catch {
    return "unreadable";
  }
}

/**
 * The content hash, which STG-152 turns into the reference.
 *
 * Written now so that the rows a church adds this month already carry it, and
 * that story is a change of reference rather than a backfill nobody can test.
 */
export function hashOf(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Takes the copy away. A row that has already gone leaves nothing to do. */
export function removeMedia(profile: string, file: string): boolean {
  const path = within(profile, file);
  if (path === null || !existsSync(path)) return false;
  rmSync(path, { force: true });
  return true;
}

/**
 * One file inside the media folder, or null.
 *
 * Every read of the folder goes through here. The windows are sandboxed and
 * ask for files by name over a protocol, so a name is untrusted input and
 * `../` is the first thing anybody tries.
 */
export function within(profile: string, file: string): string | null {
  const directory = resolve(mediaDirectory(profile));
  const path = resolve(directory, file);
  if (path !== directory && !path.startsWith(directory + sep)) return null;
  return path;
}
