/**
 * STG-6, ST2.1, ST2.5.
 *
 * The church's own song library, on the laptop.
 *
 * Two invariants live here rather than in a screen, because a screen is one of
 * several callers and the store is the last place a bad song can be stopped:
 *
 * 1. **A song is validated before it is written.** `validateWholeSong` runs on
 *    every save and an error refuses the write. That is what makes the newline
 *    guard on R12.4 binding: a blob wearing an array cannot reach the disk, so
 *    it cannot reach Phase 2.
 * 2. **Only a `local` song is written here.** `library.db` is the half of the
 *    world Stage owns. A `hearth` song is the platform's and lives in the
 *    synced cache, so this store refuses one outright. That is the two-writer
 *    rule from PRD section 2, enforced by which file a row is in.
 */

import {
  hasErrors,
  validateWholeSong,
  type Arrangement,
  type ArrangementMedia,
  type MediaKind,
  type SectionType,
  type Song,
  type SongSection,
  type WholeSong,
  type SongProblem,
} from "@hearth/songs";
import type { Db } from "./open";

export class LibraryError extends Error {
  readonly problems: SongProblem[];
  constructor(message: string, problems: SongProblem[] = []) {
    super(message);
    this.name = "LibraryError";
    this.problems = problems;
  }
}

interface SongRow {
  id: string;
  origin: string;
  title: string;
  alternate_titles: string;
  author: string | null;
  composer: string | null;
  publisher: string | null;
  year: number | null;
  ccli_number: string | null;
  copyright_line: string | null;
  is_public_domain: number;
  themes: string;
  tempo_bpm: number | null;
  time_signature: string | null;
  typical_duration_seconds: number | null;
  default_key: string | null;
  primary_language: string;
  last_used_at: string | null;
  archived_at: string | null;
}

interface SectionRow {
  id: string;
  song_id: string;
  section_type: string;
  label: string;
  sort_order: number;
  lines: string;
  language: string;
  translation_of: string | null;
}

interface ArrangementRow {
  id: string;
  song_id: string;
  name: string;
  key: string;
  tempo_bpm: number | null;
  sequence: string;
  chordpro: string | null;
  is_default: number;
}

interface MediaRow {
  id: string;
  arrangement_id: string;
  kind: string;
  storage_key: string;
  duration_seconds: number | null;
}

function toSong(row: SongRow): Song {
  return {
    id: row.id,
    origin: row.origin === "hearth" ? "hearth" : "local",
    title: row.title,
    alternateTitles: JSON.parse(row.alternate_titles) as string[],
    author: row.author,
    composer: row.composer,
    publisher: row.publisher,
    year: row.year,
    ccliNumber: row.ccli_number,
    copyrightLine: row.copyright_line,
    isPublicDomain: row.is_public_domain === 1,
    themes: JSON.parse(row.themes) as string[],
    tempoBpm: row.tempo_bpm,
    timeSignature: row.time_signature,
    typicalDurationSeconds: row.typical_duration_seconds,
    defaultKey: row.default_key as Song["defaultKey"],
    primaryLanguage: row.primary_language,
    lastUsedAt: row.last_used_at,
  };
}

function toSection(row: SectionRow): SongSection {
  return {
    id: row.id,
    songId: row.song_id,
    sectionType: row.section_type as SectionType,
    label: row.label,
    sortOrder: row.sort_order,
    lines: JSON.parse(row.lines) as string[],
    language: row.language,
    translationOf: row.translation_of,
  };
}

function toArrangement(row: ArrangementRow): Arrangement {
  return {
    id: row.id,
    songId: row.song_id,
    name: row.name,
    key: row.key as Arrangement["key"],
    tempoBpm: row.tempo_bpm,
    sequence: JSON.parse(row.sequence) as string[],
    chordpro: row.chordpro,
    isDefault: row.is_default === 1,
  };
}

function toMedia(row: MediaRow): ArrangementMedia {
  return {
    id: row.id,
    arrangementId: row.arrangement_id,
    kind: row.kind as MediaKind,
    storageKey: row.storage_key,
    durationSeconds: row.duration_seconds,
  };
}

export interface ListOptions {
  /** Archived songs are out of the library view by default (ST2.5). */
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface SongSummary {
  id: string;
  title: string;
  author: string | null;
  ccliNumber: string | null;
  defaultKey: string | null;
  origin: "local" | "hearth";
  archivedAt: string | null;
  lastUsedAt: string | null;
  arrangementCount: number;
  sectionCount: number;
}

export class Library {
  private readonly db: Db;
  private readonly now: () => string;
  private readonly afterWrite: (() => void) | null;

  constructor(
    db: Db,
    options: { now?: () => string; afterWrite?: () => void } = {},
  ) {
    this.db = db;
    this.now = options.now ?? (() => new Date().toISOString());
    this.afterWrite = options.afterWrite ?? null;
  }

  /**
   * Writes a song, with its sections and arrangements, as one unit.
   *
   * Sections and arrangements are replaced rather than merged, because the
   * caller holds the whole song and a merge would need a second opinion about
   * what was deleted. Everything happens in one transaction, so a song is never
   * on disk with last week's sections.
   */
  save(whole: WholeSong): void {
    const problems = validateWholeSong(whole);
    if (hasErrors(problems)) {
      throw new LibraryError(
        `"${whole.song.title}" cannot be saved: ${problems.filter((p) => p.severity === "error").length} problems.`,
        problems,
      );
    }

    if (whole.song.origin !== "local") {
      throw new LibraryError(
        `"${whole.song.title}" has origin "${whole.song.origin}". The library holds songs Stage owns, and a synced song belongs in the cache.`,
      );
    }

    const timestamp = this.now();

    this.db.transaction(() => {
      const existing = this.db
        .prepare("SELECT created_at FROM songs WHERE id = ?")
        .get(whole.song.id) as { created_at: string } | undefined;

      this.db
        .prepare(
          `INSERT INTO songs (
             id, origin, title, alternate_titles, author, composer, publisher, year,
             ccli_number, copyright_line, is_public_domain, themes, tempo_bpm,
             time_signature, typical_duration_seconds, default_key, primary_language,
             last_used_at, archived_at, created_at, updated_at
           ) VALUES (
             @id, @origin, @title, @alternate_titles, @author, @composer, @publisher, @year,
             @ccli_number, @copyright_line, @is_public_domain, @themes, @tempo_bpm,
             @time_signature, @typical_duration_seconds, @default_key, @primary_language,
             @last_used_at,
             COALESCE((SELECT archived_at FROM songs WHERE id = @id), NULL),
             @created_at, @updated_at
           )
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             alternate_titles = excluded.alternate_titles,
             author = excluded.author,
             composer = excluded.composer,
             publisher = excluded.publisher,
             year = excluded.year,
             ccli_number = excluded.ccli_number,
             copyright_line = excluded.copyright_line,
             is_public_domain = excluded.is_public_domain,
             themes = excluded.themes,
             tempo_bpm = excluded.tempo_bpm,
             time_signature = excluded.time_signature,
             typical_duration_seconds = excluded.typical_duration_seconds,
             default_key = excluded.default_key,
             primary_language = excluded.primary_language,
             last_used_at = excluded.last_used_at,
             updated_at = excluded.updated_at`,
        )
        .run({
          id: whole.song.id,
          origin: whole.song.origin,
          title: whole.song.title,
          alternate_titles: JSON.stringify(whole.song.alternateTitles),
          author: whole.song.author,
          composer: whole.song.composer,
          publisher: whole.song.publisher,
          year: whole.song.year,
          ccli_number: whole.song.ccliNumber,
          copyright_line: whole.song.copyrightLine,
          is_public_domain: whole.song.isPublicDomain ? 1 : 0,
          themes: JSON.stringify(whole.song.themes),
          tempo_bpm: whole.song.tempoBpm,
          time_signature: whole.song.timeSignature,
          typical_duration_seconds: whole.song.typicalDurationSeconds,
          default_key: whole.song.defaultKey,
          primary_language: whole.song.primaryLanguage,
          last_used_at: whole.song.lastUsedAt,
          created_at: existing?.created_at ?? timestamp,
          updated_at: timestamp,
        });

      this.db.prepare("DELETE FROM song_sections WHERE song_id = ?").run(whole.song.id);
      const section = this.db.prepare(
        `INSERT INTO song_sections
           (id, song_id, section_type, label, sort_order, lines, language, translation_of)
         VALUES (@id, @song_id, @section_type, @label, @sort_order, @lines, @language, @translation_of)`,
      );
      for (const row of whole.sections) {
        section.run({
          id: row.id,
          song_id: row.songId,
          section_type: row.sectionType,
          label: row.label,
          sort_order: row.sortOrder,
          lines: JSON.stringify(row.lines),
          language: row.language,
          translation_of: row.translationOf,
        });
      }

      // Media hangs off arrangements, so the cascade clears it with them.
      this.db.prepare("DELETE FROM arrangements WHERE song_id = ?").run(whole.song.id);
      const arrangement = this.db.prepare(
        `INSERT INTO arrangements
           (id, song_id, name, key, tempo_bpm, sequence, chordpro, is_default)
         VALUES (@id, @song_id, @name, @key, @tempo_bpm, @sequence, @chordpro, @is_default)`,
      );
      for (const row of whole.arrangements) {
        arrangement.run({
          id: row.id,
          song_id: row.songId,
          name: row.name,
          key: row.key,
          tempo_bpm: row.tempoBpm,
          sequence: JSON.stringify(row.sequence),
          chordpro: row.chordpro,
          is_default: row.isDefault ? 1 : 0,
        });
      }

      const media = this.db.prepare(
        `INSERT INTO arrangement_media
           (id, arrangement_id, kind, storage_key, duration_seconds)
         VALUES (@id, @arrangement_id, @kind, @storage_key, @duration_seconds)`,
      );
      for (const row of whole.media) {
        media.run({
          id: row.id,
          arrangement_id: row.arrangementId,
          kind: row.kind,
          storage_key: row.storageKey,
          duration_seconds: row.durationSeconds,
        });
      }
    })();

    this.afterWrite?.();
  }

  get(songId: string): WholeSong | null {
    const row = this.db.prepare("SELECT * FROM songs WHERE id = ?").get(songId) as
      | SongRow
      | undefined;
    if (row === undefined) return null;

    const sections = (
      this.db
        .prepare("SELECT * FROM song_sections WHERE song_id = ? ORDER BY sort_order, label")
        .all(songId) as SectionRow[]
    ).map(toSection);

    const arrangements = (
      this.db
        .prepare("SELECT * FROM arrangements WHERE song_id = ? ORDER BY is_default DESC, name")
        .all(songId) as ArrangementRow[]
    ).map(toArrangement);

    const media = (
      this.db
        .prepare(
          `SELECT m.* FROM arrangement_media m
             JOIN arrangements a ON a.id = m.arrangement_id
            WHERE a.song_id = ? ORDER BY m.kind`,
        )
        .all(songId) as MediaRow[]
    ).map(toMedia);

    return { song: toSong(row), sections, arrangements, media };
  }

  list(options: ListOptions = {}): SongSummary[] {
    const where = options.includeArchived === true ? "" : "WHERE s.archived_at IS NULL";
    const rows = this.db
      .prepare(
        `SELECT s.id, s.title, s.author, s.ccli_number, s.default_key, s.origin,
                s.archived_at, s.last_used_at,
                (SELECT COUNT(*) FROM arrangements a WHERE a.song_id = s.id) AS arrangements,
                (SELECT COUNT(*) FROM song_sections c WHERE c.song_id = s.id) AS sections
           FROM songs s
           ${where}
          ORDER BY s.title COLLATE NOCASE
          LIMIT ? OFFSET ?`,
      )
      .all(options.limit ?? 500, options.offset ?? 0) as {
      id: string;
      title: string;
      author: string | null;
      ccli_number: string | null;
      default_key: string | null;
      origin: string;
      archived_at: string | null;
      last_used_at: string | null;
      arrangements: number;
      sections: number;
    }[];

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      author: row.author,
      ccliNumber: row.ccli_number,
      defaultKey: row.default_key,
      origin: row.origin === "hearth" ? "hearth" : "local",
      archivedAt: row.archived_at,
      lastUsedAt: row.last_used_at,
      arrangementCount: row.arrangements,
      sectionCount: row.sections,
    }));
  }

  count(options: ListOptions = {}): number {
    const where = options.includeArchived === true ? "" : "WHERE archived_at IS NULL";
    const row = this.db.prepare(`SELECT COUNT(*) AS n FROM songs ${where}`).get() as { n: number };
    return row.n;
  }

  /**
   * Takes a song out of the library and keeps it.
   *
   * Archive rather than delete, which is the rule across the whole product. The
   * song leaves every list and its usage history survives, because "what did we
   * sing in 2026" has to keep answering after somebody tidies up.
   */
  archive(songId: string): boolean {
    const result = this.db
      .prepare("UPDATE songs SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL")
      .run(this.now(), this.now(), songId);
    if (result.changes > 0) this.afterWrite?.();
    return result.changes > 0;
  }

  restore(songId: string): boolean {
    const result = this.db
      .prepare("UPDATE songs SET archived_at = NULL, updated_at = ? WHERE id = ?")
      .run(this.now(), songId);
    if (result.changes > 0) this.afterWrite?.();
    return result.changes > 0;
  }

  isArchived(songId: string): boolean {
    const row = this.db.prepare("SELECT archived_at FROM songs WHERE id = ?").get(songId) as
      | { archived_at: string | null }
      | undefined;
    return row?.archived_at !== null && row?.archived_at !== undefined;
  }

  /** Every song whole, for an export (ST2.12) or a deck that needs the library. */
  all(options: ListOptions = {}): WholeSong[] {
    return this.list(options)
      .map((summary) => this.get(summary.id))
      .filter((whole): whole is WholeSong => whole !== null);
  }
}
