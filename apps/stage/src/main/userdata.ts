/**
 * STG-168, ST19.5. Where a church's library lives, and its name.
 *
 * Electron names the data directory after the package when nothing says
 * otherwise, so a church's only copy of its library sat in a folder called
 * `@hearth/stage`. That is a thing nobody can find, nobody can back up on
 * purpose, and nobody would recognise in a support call.
 *
 * Renaming moves the library, which is the part that has to be right: for an
 * unpaired church those files are the only copy of everything they typed. So
 * the decision is a function with no filesystem in it, tested, and then carried
 * out once on the way up.
 *
 * **The decision is about the library, rather than about the directory.**
 * Chromium creates the new data directory for its own caches before any of this
 * runs, so a rule that asked whether the directory existed found that it always
 * did and never moved anything. It asks about `library.db`.
 */

export const APP_NAME = "Hearth Stage";

/** The folder Electron chose before this story, named after the package. */
export const OLD_FOLDER = "@hearth/stage";

/** The library file, the two SQLite keeps beside it, and the backups. */
export const LIBRARY_ENTRIES = [
  "library.db",
  "library.db-wal",
  "library.db-shm",
  "backups",
] as const;

/** The one whose presence decides whether a directory holds a library. */
export const LIBRARY_FILE = "library.db";

export type RelocationReason =
  | "moved"
  | "nothing-to-move"
  | "already-there"
  | "same-place";

export interface Relocation {
  action: "move" | "none";
  reason: RelocationReason;
  /** What to move, in order. Empty where nothing is moving. */
  entries: string[];
}

export interface RelocationFacts {
  from: string;
  to: string;
  /** Whether a name exists inside a directory. */
  has: (directory: string, name: string) => boolean;
  /** Joins a directory and a name, so this file needs no path module. */
  join?: (directory: string, name: string) => string;
}

/**
 * Whether the old library should be moved, and what to carry.
 *
 * Two cases are refusals, and each would lose work if it were a move:
 *
 * - **The old directory holds no library.** A fresh install, or one that has
 *   already moved.
 * - **The new directory already holds one.** That library is live, and
 *   overwriting it would throw away whatever has been typed into it. The old
 *   files stay where they are, so a church keeps both.
 */
export function relocation(facts: RelocationFacts): Relocation {
  const nothing = (reason: RelocationReason): Relocation => ({
    action: "none",
    reason,
    entries: [],
  });

  if (facts.from === facts.to) return nothing("same-place");
  if (!facts.has(facts.from, LIBRARY_FILE)) return nothing("nothing-to-move");
  if (facts.has(facts.to, LIBRARY_FILE)) return nothing("already-there");

  return {
    action: "move",
    reason: "moved",
    entries: LIBRARY_ENTRIES.filter((name) => facts.has(facts.from, name)),
  };
}
