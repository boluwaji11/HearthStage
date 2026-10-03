/**
 * STG-54, ST2.12. The library as one file.
 *
 * OpenLyrics is the door out that another presenter can read. This is the door
 * out that loses nothing: the Hearth schema as it stands, so a church taking its
 * library can put the whole of it back, arrangements, presentations, plans and
 * all.
 *
 * `schema` is the contract. A reader that does not know a version refuses it
 * rather than guessing, for the same reason the store refuses a database written
 * by a newer Stage: a silent partial read loses a church's work.
 */

import type { Presentation } from "./presentation";
import type { SetList } from "./setlist";
import type { WholeSong } from "./types";

/** Raised whenever the shape below changes in a way a reader would misread. */
export const BUNDLE_SCHEMA = 1;

export interface Bundle {
  schema: number;
  /** Which Stage wrote it, for a person reading the file rather than a parser. */
  writtenBy: string;
  /** RFC 3339. */
  writtenAt: string;
  songs: WholeSong[];
  presentations: Presentation[];
  /** Running orders, which point at the songs and presentations above. */
  plans: SetList[];
}

export interface BundleParts {
  songs?: readonly WholeSong[];
  presentations?: readonly Presentation[];
  plans?: readonly SetList[];
}

/**
 * The bundle, in a stable order.
 *
 * Sorted by id rather than left in whatever order the store returned, so
 * exporting the same library twice produces the same bytes and a church keeping
 * these in version control sees only what changed.
 */
export function toBundle(parts: BundleParts, at: string, writtenBy = "Hearth Stage"): Bundle {
  return {
    schema: BUNDLE_SCHEMA,
    writtenBy,
    writtenAt: at,
    songs: [...(parts.songs ?? [])].sort((a, b) => a.song.id.localeCompare(b.song.id)),
    presentations: [...(parts.presentations ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    plans: [...(parts.plans ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/** The file a church gets. Indented, because somebody will open it in an editor. */
export function bundleJson(bundle: Bundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export type BundleProblem = "not an object" | "no schema" | "newer schema";

/**
 * Reads a bundle back, or says why it cannot.
 *
 * Refuses a newer schema rather than reading what it recognises, because a
 * partial restore that looks like a whole one is how a church loses the half it
 * could not see.
 */
export function readBundle(text: string): { bundle: Bundle } | { problem: BundleProblem } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { problem: "not an object" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { problem: "not an object" };
  }

  const candidate = parsed as Partial<Bundle>;
  if (typeof candidate.schema !== "number") return { problem: "no schema" };
  if (candidate.schema > BUNDLE_SCHEMA) return { problem: "newer schema" };

  return {
    bundle: {
      schema: candidate.schema,
      writtenBy: typeof candidate.writtenBy === "string" ? candidate.writtenBy : "",
      writtenAt: typeof candidate.writtenAt === "string" ? candidate.writtenAt : "",
      songs: Array.isArray(candidate.songs) ? candidate.songs : [],
      presentations: Array.isArray(candidate.presentations) ? candidate.presentations : [],
      plans: Array.isArray(candidate.plans) ? candidate.plans : [],
    },
  };
}
