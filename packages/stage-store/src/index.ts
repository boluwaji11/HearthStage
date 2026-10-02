/**
 * @hearth/stage-store
 *
 * Stage's own storage. SQLite on the operator's laptop, holding the library a
 * church types in and imports, with the synced cache beside it.
 *
 * Split by durability and by who writes it, which is the decision that makes
 * the two-writer rule in PRD-STAGE section 2 a property of the filesystem
 * rather than a check somebody has to remember:
 *
 * - `library.db` is the church's own work, written by Stage, backed up on every
 *   write. For an unpaired church it is the only copy.
 * - `cache.db` is synced from the platform, read-only in Stage, and rebuilt by
 *   a resync. It arrives with STG-91.
 *
 * See docs/stage-architecture.md, "Local store".
 */

export { openDatabase, type Db, type Durability, type OpenOptions } from "./open";
export { migrate, currentVersion, MIGRATIONS, SCHEMA_VERSION, type Migration } from "./migrate";
export {
  Library,
  LibraryError,
  type ListOptions,
  type SongSummary,
} from "./library";
export { backup, backups, isUsable, restore, type BackupInfo, type BackupOptions } from "./backup";
export { openLibrary, type OpenLibrary } from "./open-library";
