/**
 * STG-6. Opening a database, with the settings that decide whether a church
 * loses its library.
 *
 * Two databases, two different answers about durability, because they hold
 * different things (docs/architecture.md, "Local store"):
 *
 * - **`library.db` is the church's own work.** For an unpaired church it is the
 *   only copy. Writes are rare and human paced, so it runs with
 *   `synchronous = FULL`: a power cut during an edit before a service costs the
 *   edit rather than the file.
 * - **`cache.db` is synced from the platform and disposable.** It runs with
 *   `synchronous = NORMAL`, because the worst case is a resync.
 */

import Database from "better-sqlite3";

export type Durability = "library" | "cache";

export interface OpenOptions {
  /** Defaults to `library`, which is the careful one. */
  durability?: Durability;
  readonly?: boolean;
}

export type Db = Database.Database;

export function openDatabase(path: string, options: OpenOptions = {}): Db {
  const durability = options.durability ?? "library";
  const db = new Database(path, { readonly: options.readonly ?? false });

  // WAL so a read during a write does not block, which matters once the
  // renderer is reading the library while an import is writing it.
  db.pragma("journal_mode = WAL");
  db.pragma(`synchronous = ${durability === "library" ? "FULL" : "NORMAL"}`);
  // Sections and arrangements belong to a song and go when it goes.
  db.pragma("foreign_keys = ON");
  // A lock held by an import should wait rather than fail.
  db.pragma("busy_timeout = 5000");

  return db;
}
