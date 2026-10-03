/**
 * STG-6. Migrations.
 *
 * `library.db` holds data a church typed in and cannot get back, on a laptop
 * that updates itself (ST19.7). So the schema has to move forward without
 * asking anybody, and a migration that half ran would be the worst outcome
 * available.
 *
 * **Hand written, versioned by `PRAGMA user_version`, each step in one
 * transaction.** Deliberately not a migration tool: this file is the entire
 * mechanism, it can be read in a minute, and it has no version of its own to
 * fall out of step with the data. The platform's Postgres schema uses Drizzle
 * and drizzle-kit, where the generated SQL and the review process earn their
 * keep. A laptop database with four tables does not.
 *
 * Rules for adding a step: append it. A step that has shipped is fixed, because
 * somebody's database has already run it.
 */

import type { Db } from "./open";

export interface Migration {
  version: number;
  name: string;
  up: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "the library",
    up: `
      CREATE TABLE songs (
        id                       TEXT PRIMARY KEY,
        origin                   TEXT NOT NULL DEFAULT 'local'
                                   CHECK (origin IN ('local', 'hearth')),
        title                    TEXT NOT NULL,
        alternate_titles         TEXT NOT NULL DEFAULT '[]',
        author                   TEXT,
        composer                 TEXT,
        publisher                TEXT,
        year                     INTEGER,
        ccli_number              TEXT,
        copyright_line           TEXT,
        is_public_domain         INTEGER NOT NULL DEFAULT 0,
        themes                   TEXT NOT NULL DEFAULT '[]',
        tempo_bpm                INTEGER,
        time_signature           TEXT,
        typical_duration_seconds INTEGER,
        default_key              TEXT,
        primary_language         TEXT NOT NULL DEFAULT 'en',
        last_used_at             TEXT,
        archived_at              TEXT,
        created_at               TEXT NOT NULL,
        updated_at               TEXT NOT NULL
      );

      CREATE TABLE song_sections (
        id             TEXT PRIMARY KEY,
        song_id        TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        section_type   TEXT NOT NULL,
        label          TEXT NOT NULL,
        sort_order     INTEGER NOT NULL,
        lines          TEXT NOT NULL,
        language       TEXT NOT NULL,
        translation_of TEXT
      );

      CREATE TABLE arrangements (
        id         TEXT PRIMARY KEY,
        song_id    TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        key        TEXT NOT NULL,
        tempo_bpm  INTEGER,
        sequence   TEXT NOT NULL,
        chordpro   TEXT,
        is_default INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE arrangement_media (
        id               TEXT PRIMARY KEY,
        arrangement_id   TEXT NOT NULL REFERENCES arrangements(id) ON DELETE CASCADE,
        kind             TEXT NOT NULL,
        storage_key      TEXT NOT NULL,
        duration_seconds INTEGER
      );

      -- A label is what a sequence refers to, so it is unique within a song.
      -- Enforced here as well as in the validator, because the store is the
      -- last place a bad song can be stopped.
      CREATE UNIQUE INDEX songs_section_label ON song_sections(song_id, label);
      CREATE INDEX song_sections_order ON song_sections(song_id, sort_order);
      CREATE INDEX arrangements_song ON arrangements(song_id);
      CREATE INDEX arrangement_media_arrangement ON arrangement_media(arrangement_id);
      CREATE INDEX songs_title ON songs(title);
      CREATE INDEX songs_ccli ON songs(ccli_number);
      CREATE INDEX songs_archived ON songs(archived_at);
    `,
  },
  {
    version: 2,
    name: "presentations",
    up: `
      CREATE TABLE presentations (
        id           TEXT PRIMARY KEY,
        origin       TEXT NOT NULL DEFAULT 'local'
                       CHECK (origin IN ('local', 'hearth')),
        kind         TEXT NOT NULL DEFAULT 'plain',
        title        TEXT NOT NULL,
        theme_id     TEXT,
        last_used_at TEXT,
        archived_at  TEXT,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      );

      CREATE TABLE presentation_slides (
        id              TEXT PRIMARY KEY,
        presentation_id TEXT NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
        sort_order      INTEGER NOT NULL,
        label           TEXT,
        lines           TEXT NOT NULL,
        notes           TEXT
      );

      CREATE INDEX presentation_slides_order
        ON presentation_slides(presentation_id, sort_order);
      CREATE INDEX presentations_title ON presentations(title);
      CREATE INDEX presentations_archived ON presentations(archived_at);
    `,
  },
  {
    version: 3,
    name: "reading reference",
    up: `
      -- A reading carries where it is from, and Stage puts it on every slide of
      -- the passage so somebody arriving at slide three knows where they are
      -- (STG-26, ST7.3). Null on everything else, which is most items.
      ALTER TABLE presentations ADD COLUMN reference TEXT;
    `,
  },
  {
    version: 4,
    name: "set lists",
    up: `
      -- The running order a church types for one service (STG-46, ST2.8). An
      -- entry points at a library row rather than copying it, so fixing a typo
      -- in a hymn fixes it in next Sunday's order as well.
      CREATE TABLE set_lists (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        date        TEXT NOT NULL,
        archived_at TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE set_entries (
        id          TEXT PRIMARY KEY,
        set_list_id TEXT NOT NULL REFERENCES set_lists(id) ON DELETE CASCADE,
        sort_order  INTEGER NOT NULL,
        kind        TEXT NOT NULL DEFAULT 'item'
                      CHECK (kind IN ('item', 'marker')),
        -- No foreign key on purpose. An order that names a song somebody later
        -- archived still has to read as an order, and the deck compiler reports
        -- the gap by name (ST5.2).
        item_id     TEXT,
        title       TEXT NOT NULL,
        notes       TEXT
      );

      CREATE INDEX set_entries_order ON set_entries(set_list_id, sort_order);
      CREATE INDEX set_lists_date ON set_lists(date);
      CREATE INDEX set_lists_archived ON set_lists(archived_at);
    `,
  },
  {
    version: 5,
    name: "the shelf",
    up: `
      -- A slide typed inside a presentation plan belongs to that plan (STG-169).
      -- The library is a shelf somebody puts a thing on, so the flag says
      -- whether this row is on it. Everything written before this migration
      -- was typed in the library, which is why the default is 1.
      ALTER TABLE presentations ADD COLUMN in_library INTEGER NOT NULL DEFAULT 1;

      CREATE INDEX presentations_shelf ON presentations(in_library);
    `,
  },
  {
    version: 6,
    name: "the usage log",
    up: `
      -- Every song a church actually put on the wall (STG-52, ST2.10).
      --
      -- Written when a song is shown rather than when a plan is opened, so the
      -- CCLI report reflects the service instead of the intention. A small
      -- church gets fined for failing that report, so this is the record the
      -- fine turns on.
      --
      -- No foreign key on song_id. The log outlives the song: a church that
      -- archives a hymn in March still has to report the February service it
      -- was sung in.
      CREATE TABLE song_usage (
        id             TEXT PRIMARY KEY,
        song_id        TEXT NOT NULL,
        -- Copied rather than joined, for the same reason. A report run next
        -- year has to name what was sung even if the row has since gone.
        title          TEXT NOT NULL,
        author         TEXT,
        ccli_number    TEXT,
        -- The service date in the church's timezone, YYYY-MM-DD. What CCLI
        -- asks for, and what a period is filtered on.
        service_date   TEXT NOT NULL,
        set_list_id    TEXT,
        set_list_title TEXT,
        arrangement_id TEXT,
        song_key       TEXT,
        -- RFC 3339, the moment it went on the wall.
        shown_at       TEXT NOT NULL
      );

      -- One row per song per service. A chorus the operator goes back to is
      -- the same use, and a report that counted it twice would be wrong.
      CREATE UNIQUE INDEX song_usage_once
        ON song_usage(song_id, service_date, COALESCE(set_list_id, ''));

      CREATE INDEX song_usage_period ON song_usage(service_date);
    `,
  },
];

export const SCHEMA_VERSION = MIGRATIONS.reduce(
  (highest, migration) => Math.max(highest, migration.version),
  0,
);

export function currentVersion(db: Db): number {
  const [row] = db.pragma("user_version") as { user_version: number }[];
  return row?.user_version ?? 0;
}

/**
 * Brings a database up to date, and says what it did.
 *
 * Each step runs inside a transaction with its own version bump, so an
 * interrupted upgrade leaves the database at the last step that finished rather
 * than halfway through the next one.
 */
export function migrate(db: Db): { from: number; to: number; applied: string[] } {
  const from = currentVersion(db);
  const applied: string[] = [];

  if (from > SCHEMA_VERSION) {
    // A library written by a newer Stage. Refused rather than guessed at: a
    // downgrade that silently dropped a column would lose a church's work.
    throw new Error(
      `This library was written by a newer version of Stage (schema ${from}, this build understands ${SCHEMA_VERSION}).`,
    );
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= from) continue;
    db.exec("BEGIN");
    try {
      db.exec(migration.up);
      db.pragma(`user_version = ${migration.version}`);
      db.exec("COMMIT");
      applied.push(`${migration.version}: ${migration.name}`);
    } catch (cause) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${migration.version} (${migration.name}) failed.`, { cause });
    }
  }

  return { from, to: currentVersion(db), applied };
}
