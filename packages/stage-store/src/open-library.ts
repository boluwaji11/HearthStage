/**
 * STG-6. Opening the library the way the application opens it.
 *
 * One function so that the Electron main process, a test, and the import worker
 * all get the same pragmas, the same migrations and the same backup behaviour.
 * A caller that assembles these by hand will eventually assemble them wrongly.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { backup } from "./backup";
import { Library } from "./library";
import { migrate } from "./migrate";
import { openDatabase, type Db } from "./open";

export interface OpenLibrary {
  db: Db;
  library: Library;
  /** What the migrator did, worth logging on a version upgrade. */
  migrated: { from: number; to: number; applied: string[] };
  close(): void;
}

export interface OpenLibraryOptions {
  /** Off for a test that is checking something other than backups. */
  backups?: boolean;
  generations?: number;
  now?: () => string;
  /** Passed through to better-sqlite3. See `OpenOptions.nativeBinding`. */
  nativeBinding?: string;
}

export function openLibrary(path: string, options: OpenLibraryOptions = {}): OpenLibrary {
  mkdirSync(dirname(path), { recursive: true });

  const db = openDatabase(path, {
    durability: "library",
    ...(options.nativeBinding === undefined ? {} : { nativeBinding: options.nativeBinding }),
  });
  const migrated = migrate(db);

  const wantsBackups = options.backups ?? true;

  const library = new Library(db, {
    now: options.now,
    afterWrite: wantsBackups
      ? () => {
          // Backups must never take a write down with them. A disk that is full
          // or a directory that is not writable is a problem to report, and the
          // song the operator just typed is already safely committed.
          void backup(db, path, { generations: options.generations }).catch(() => undefined);
        }
      : undefined,
  });

  return {
    db,
    library,
    migrated,
    close: () => db.close(),
  };
}
