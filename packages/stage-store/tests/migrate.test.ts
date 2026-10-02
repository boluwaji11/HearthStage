/**
 * STG-6, ST19.4, ST19.7.
 *
 * The library is data a church cannot get back, on a laptop that updates
 * itself. So the migrator has to be boring, and these are the cases where a
 * migrator stops being boring.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  currentVersion,
  migrate,
  openDatabase,
  MIGRATIONS,
  SCHEMA_VERSION,
  type Db,
} from "../src/index";

let directory: string;
let db: Db;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hearth-migrate-"));
  db = openDatabase(join(directory, "library.db"));
});

afterEach(() => {
  try {
    db.close();
  } catch {
    // A test may have closed it already.
  }
  rmSync(directory, { recursive: true, force: true });
});

describe("migrate", () => {
  it("takes an empty file to the current schema", () => {
    expect(currentVersion(db)).toBe(0);
    const result = migrate(db);
    expect(result.from).toBe(0);
    expect(result.to).toBe(SCHEMA_VERSION);
    expect(result.applied).toHaveLength(MIGRATIONS.length);
  });

  it("does nothing the second time", () => {
    migrate(db);
    const again = migrate(db);
    expect(again.applied).toEqual([]);
    expect(again.from).toBe(SCHEMA_VERSION);
  });

  it("refuses a library written by a newer Stage", () => {
    // A downgrade that silently dropped a column would lose a church's work,
    // so this is refused rather than guessed at.
    migrate(db);
    db.pragma(`user_version = ${SCHEMA_VERSION + 5}`);
    expect(() => migrate(db)).toThrow(/newer version of Stage/);
  });

  it("leaves nothing behind when a step fails", () => {
    // Each step is one transaction with its own version bump, so an
    // interrupted upgrade stops at the last step that finished.
    const broken = [...MIGRATIONS, { version: 99, name: "broken", up: "CREATE TABLE ;" }];
    const before = currentVersion(db);

    expect(() => {
      // Same mechanism, with a step that cannot run.
      for (const migration of broken) {
        if (migration.version <= before) continue;
        db.exec("BEGIN");
        try {
          db.exec(migration.up);
          db.pragma(`user_version = ${migration.version}`);
          db.exec("COMMIT");
        } catch (cause) {
          db.exec("ROLLBACK");
          throw new Error(`Migration ${migration.version} failed.`, { cause });
        }
      }
    }).toThrow(/Migration 99 failed/);

    // The good step committed. The broken one left no trace.
    expect(currentVersion(db)).toBe(SCHEMA_VERSION);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    expect(tables.map((table) => table.name)).toContain("songs");
  });

  it("creates every table and index the library needs", () => {
    migrate(db);
    const objects = db
      .prepare("SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")
      .all() as { type: string; name: string }[];

    const tables = objects.filter((o) => o.type === "table").map((o) => o.name);
    expect(tables.sort()).toEqual([
      "arrangement_media",
      "arrangements",
      "presentation_slides",
      "presentations",
      "song_sections",
      "songs",
    ]);
    expect(objects.filter((o) => o.type === "index").map((o) => o.name)).toContain(
      "songs_section_label",
    );
  });

  it("has the pragmas that decide whether a church loses its library", () => {
    const [journal] = db.pragma("journal_mode") as { journal_mode: string }[];
    const [sync] = db.pragma("synchronous") as { synchronous: number }[];
    const [keys] = db.pragma("foreign_keys") as { foreign_keys: number }[];

    expect(journal?.journal_mode).toBe("wal");
    // FULL, because this file is the only copy for a church that never pairs.
    expect(sync?.synchronous).toBe(2);
    expect(keys?.foreign_keys).toBe(1);
  });

  it("clears sections and arrangements with the song they belong to", () => {
    migrate(db);
    db.exec(`
      INSERT INTO songs (id, title, primary_language, created_at, updated_at)
        VALUES ('s', 'A Song', 'en', '2026-10-01', '2026-10-01');
      INSERT INTO song_sections (id, song_id, section_type, label, sort_order, lines, language)
        VALUES ('c', 's', 'verse', 'V1', 0, '["A line"]', 'en');
      INSERT INTO arrangements (id, song_id, name, key, sequence)
        VALUES ('a', 's', 'Default', 'C', '["V1"]');
      INSERT INTO arrangement_media (id, arrangement_id, kind, storage_key)
        VALUES ('m', 'a', 'reference_audio', 'sha256:abc');
    `);

    db.prepare("DELETE FROM songs WHERE id = 's'").run();

    for (const table of ["song_sections", "arrangements", "arrangement_media"]) {
      const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
      expect(row.n, table).toBe(0);
    }
  });

  it("refuses an origin outside the two it knows", () => {
    migrate(db);
    expect(() =>
      db.exec(
        `INSERT INTO songs (id, origin, title, primary_language, created_at, updated_at)
           VALUES ('s', 'somewhere-else', 'A Song', 'en', '2026-10-01', '2026-10-01')`,
      ),
    ).toThrow();
  });
});
