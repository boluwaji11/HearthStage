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
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  rmSync,
  statSync,
} from "node:fs";
import { extname, join, resolve, sep } from "node:path";

import type { MediaFileKind } from "@hearth/stage-store";

/**
 * What Stage takes.
 *
 * Wide on purpose. A church has what a church has: a loop somebody exported as
 * QuickTime, a photograph a phone wrote as AVIF, a video off an old camera.
 * Refusing a file at the door tells somebody their file does not exist, which
 * is worse than telling them it will not play.
 *
 * `plays` says whether Chromium decodes it everywhere Stage runs. A `"maybe"`
 * is taken in and checked where it is drawn, so the tile says what happened
 * rather than the dialog guessing (ST9.9).
 */
export const MEDIA_TYPES: Record<string, { kind: MediaFileKind; mime: string; plays: Plays }> = {
  // Images Chromium decodes on every platform.
  ".png": { kind: "image", mime: "image/png", plays: "sure" },
  ".jpg": { kind: "image", mime: "image/jpeg", plays: "sure" },
  ".jpeg": { kind: "image", mime: "image/jpeg", plays: "sure" },
  ".jfif": { kind: "image", mime: "image/jpeg", plays: "sure" },
  ".webp": { kind: "image", mime: "image/webp", plays: "sure" },
  ".gif": { kind: "image", mime: "image/gif", plays: "sure" },
  ".svg": { kind: "image", mime: "image/svg+xml", plays: "sure" },
  ".avif": { kind: "image", mime: "image/avif", plays: "sure" },
  ".bmp": { kind: "image", mime: "image/bmp", plays: "sure" },
  ".ico": { kind: "image", mime: "image/x-icon", plays: "sure" },
  // Images a camera or a scanner writes that Chromium will not draw.
  ".heic": { kind: "image", mime: "image/heic", plays: "maybe" },
  ".heif": { kind: "image", mime: "image/heif", plays: "maybe" },
  ".tif": { kind: "image", mime: "image/tiff", plays: "maybe" },
  ".tiff": { kind: "image", mime: "image/tiff", plays: "maybe" },

  // Video Chromium decodes on every platform.
  ".mp4": { kind: "video", mime: "video/mp4", plays: "sure" },
  ".m4v": { kind: "video", mime: "video/mp4", plays: "sure" },
  ".webm": { kind: "video", mime: "video/webm", plays: "sure" },
  ".ogv": { kind: "video", mime: "video/ogg", plays: "sure" },
  // Containers that usually hold something Chromium reads, and sometimes do
  // not. A QuickTime file of H.264 plays; one of ProRes does not.
  ".mov": { kind: "video", mime: "video/quicktime", plays: "maybe" },
  ".mkv": { kind: "video", mime: "video/x-matroska", plays: "maybe" },
  ".m2ts": { kind: "video", mime: "video/mp2t", plays: "maybe" },
  ".mts": { kind: "video", mime: "video/mp2t", plays: "maybe" },
  ".3gp": { kind: "video", mime: "video/3gpp", plays: "maybe" },
  ".avi": { kind: "video", mime: "video/x-msvideo", plays: "maybe" },
  ".wmv": { kind: "video", mime: "video/x-ms-wmv", plays: "maybe" },
  ".mpg": { kind: "video", mime: "video/mpeg", plays: "maybe" },
  ".mpeg": { kind: "video", mime: "video/mpeg", plays: "maybe" },
  ".flv": { kind: "video", mime: "video/x-flv", plays: "maybe" },

  // Audio Chromium decodes on every platform.
  ".mp3": { kind: "audio", mime: "audio/mpeg", plays: "sure" },
  ".m4a": { kind: "audio", mime: "audio/mp4", plays: "sure" },
  ".aac": { kind: "audio", mime: "audio/aac", plays: "sure" },
  ".wav": { kind: "audio", mime: "audio/wav", plays: "sure" },
  ".ogg": { kind: "audio", mime: "audio/ogg", plays: "sure" },
  ".oga": { kind: "audio", mime: "audio/ogg", plays: "sure" },
  ".opus": { kind: "audio", mime: "audio/ogg", plays: "sure" },
  ".flac": { kind: "audio", mime: "audio/flac", plays: "sure" },
  ".weba": { kind: "audio", mime: "audio/webm", plays: "sure" },
  ".wma": { kind: "audio", mime: "audio/x-ms-wma", plays: "maybe" },
  ".aiff": { kind: "audio", mime: "audio/aiff", plays: "maybe" },
  ".aif": { kind: "audio", mime: "audio/aiff", plays: "maybe" },
};

/** Whether Chromium decodes this everywhere Stage runs (ST9.9). */
export type Plays = "sure" | "maybe";

/** The dialog, grouped, so somebody looking for a photograph sees photographs. */
export function dialogFilters(
  names: Record<MediaFileKind | "all", string>,
): { name: string; extensions: string[] }[] {
  const of = (kind: MediaFileKind): string[] =>
    Object.entries(MEDIA_TYPES)
      .filter(([, type]) => type.kind === kind)
      .map(([extension]) => extension.slice(1));
  return [
    { name: names.all, extensions: MEDIA_EXTENSIONS },
    { name: names.image, extensions: of("image") },
    { name: names.video, extensions: of("video") },
    { name: names.audio, extensions: of("audio") },
  ];
}

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

export function typeOf(path: string): { kind: MediaFileKind; mime: string; plays: Plays } | null {
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
 * What a file is (STG-152, ST9.11).
 *
 * The hash rather than the name or the folder, so a church that reorganises
 * its folders, or adds the same photograph twice from two of them, is talking
 * about one file both times.
 *
 * Read in chunks, because a ten minute loop is gigabytes and holding one in
 * memory to hash it would take the application down on the laptop at the back
 * of the hall.
 */
export function hashOf(path: string): string {
  const digest = createHash("sha256");
  const chunk = Buffer.alloc(1024 * 1024);
  const handle = openSync(path, "r");
  try {
    for (;;) {
      const read = readSync(handle, chunk, 0, chunk.byteLength, null);
      if (read === 0) break;
      digest.update(chunk.subarray(0, read));
    }
  } finally {
    closeSync(handle);
  }
  return digest.digest("hex");
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
