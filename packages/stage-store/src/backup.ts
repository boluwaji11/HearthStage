/**
 * STG-6, ST19.5.
 *
 * Backing up the library.
 *
 * For a church that never pairs with the platform, `library.db` is the only
 * copy of work somebody typed in on a Tuesday evening. So every write makes a
 * backup, and generations rotate so that a corruption written yesterday does
 * not take the only good copy with it.
 *
 * SQLite's own online backup is used rather than a file copy, because a copy
 * taken while a write is in flight produces a file that opens and is wrong,
 * which is worse than no backup at all.
 */

import { existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { openDatabase, type Db } from "./open";

export interface BackupOptions {
  /** How many generations to keep. Defaults to three. */
  generations?: number;
  /** Where they go. Defaults to a `backups` directory beside the database. */
  directory?: string;
}

export interface BackupInfo {
  path: string;
  bytes: number;
  takenAt: Date;
}

function backupDirectory(databasePath: string, options: BackupOptions): string {
  return options.directory ?? join(dirname(databasePath), "backups");
}

function generationPath(directory: string, index: number): string {
  return join(directory, index === 0 ? "library.db" : `library.${index}.db`);
}

/**
 * Takes a backup, rotating the older ones along.
 *
 * Generation 0 is the newest. The oldest is dropped.
 */
export async function backup(
  db: Db,
  databasePath: string,
  options: BackupOptions = {},
): Promise<BackupInfo> {
  const generations = Math.max(1, options.generations ?? 3);
  const directory = backupDirectory(databasePath, options);
  mkdirSync(directory, { recursive: true });

  // Rotate from the oldest backwards, so nothing is overwritten before it has
  // moved.
  const oldest = generationPath(directory, generations - 1);
  if (existsSync(oldest)) rmSync(oldest);
  for (let index = generations - 2; index >= 0; index -= 1) {
    const from = generationPath(directory, index);
    if (existsSync(from)) renameSync(from, generationPath(directory, index + 1));
  }

  const target = generationPath(directory, 0);
  await db.backup(target);

  return { path: target, bytes: statSync(target).size, takenAt: new Date() };
}

/** The backups on disk, newest first. */
export function backups(databasePath: string, options: BackupOptions = {}): BackupInfo[] {
  const directory = backupDirectory(databasePath, options);
  const generations = Math.max(1, options.generations ?? 3);
  const found: BackupInfo[] = [];

  for (let index = 0; index < generations; index += 1) {
    const path = generationPath(directory, index);
    if (!existsSync(path)) continue;
    const stat = statSync(path);
    found.push({ path, bytes: stat.size, takenAt: stat.mtime });
  }

  return found;
}

/**
 * Checks a backup opens and holds a library before it is trusted.
 *
 * A restore offered from a file that turns out to be unreadable is worse than
 * no restore offered, because by then the person has already given up on the
 * original.
 */
export function isUsable(path: string): boolean {
  if (!existsSync(path)) return false;
  let db: Db | null = null;
  try {
    db = openDatabase(path, { readonly: true });
    const row = db.prepare("SELECT COUNT(*) AS n FROM songs").get() as { n: number };
    db.pragma("integrity_check");
    return typeof row.n === "number";
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

/**
 * Puts a backup back, keeping what was there.
 *
 * The file being replaced is moved aside rather than deleted, because a person
 * restoring a backup is already having a bad day and a mistaken restore should
 * not be the end of it.
 */
export function restore(
  databasePath: string,
  backupPath: string,
): { restored: string; movedAside: string | null } {
  if (!isUsable(backupPath)) {
    throw new Error(`${backupPath} is not a library this can read.`);
  }

  let movedAside: string | null = null;
  if (existsSync(databasePath)) {
    movedAside = `${databasePath}.replaced-${Date.now()}`;
    renameSync(databasePath, movedAside);
  }

  // WAL and shared memory files belong to the database that was moved. Left
  // behind they would be applied to the restored file and undo the restore.
  for (const suffix of ["-wal", "-shm"]) {
    const stray = `${databasePath}${suffix}`;
    if (existsSync(stray)) rmSync(stray);
  }

  const source = openDatabase(backupPath, { readonly: true });
  try {
    source.exec(`VACUUM INTO '${databasePath.replace(/'/g, "''")}'`);
  } finally {
    source.close();
  }

  return { restored: databasePath, movedAside };
}
