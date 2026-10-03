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
  presentationHasErrors,
  slideCount,
  validatePresentation,
  validateWholeSong,
  type Arrangement,
  type ArrangementMedia,
  type MediaKind,
  type SectionType,
  type Song,
  type SongSection,
  type WholeSong,
  type SongProblem,
  type Presentation,
  type PresentationProblem,
  type PresentationSlide,
  type PresentationKind,
  orderedEntries,
  setListHasErrors,
  validateSetList,
  type ItemKind,
  type SetEntry,
  type SetList,
} from "@hearth/songs";
import type { Db } from "./open";

export class LibraryError extends Error {
  readonly problems: (SongProblem | PresentationProblem)[];
  constructor(message: string, problems: (SongProblem | PresentationProblem)[] = []) {
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

/**
 * One song, on one service, as the usage log holds it (STG-52, ST2.10).
 *
 * The song's name and CCLI number are copied rather than joined, because the
 * log outlives the song: a church that archives a hymn in March still has to
 * report the February service it was sung in.
 */
/**
 * A church's own grouping of the library (STG-150, ST2.18).
 *
 * Two hundred presentations are not findable by a search box alone, because a
 * search box needs you to already know the name. "Christmas" is how a church
 * actually looks for what it has.
 */
export interface Collection {
  id: string;
  name: string;
  sortOrder: number;
  /** How many library items are in it. */
  items: number;
}

/**
 * One file a church added once and can use anywhere (STG-151, ST9.10).
 *
 * `file` is the name inside the profile's media folder rather than where the
 * church found it, because the file is copied in. `hash` is written now and
 * used by STG-152.
 */
export interface MediaItem {
  id: string;
  kind: MediaFileKind;
  name: string;
  file: string;
  mime: string;
  bytes: number;
  hash: string | null;
  createdAt: string;
  updatedAt: string;
}

export const MEDIA_FILE_KINDS = ["image", "video", "audio"] as const;

/** Named apart from a song's ArrangementMedia, which is a different thing. */
export type MediaFileKind = (typeof MEDIA_FILE_KINDS)[number];

export interface SongUse {
  songId: string;
  title: string;
  author?: string | null;
  ccliNumber?: string | null;
  /** The service date in the church's timezone, YYYY-MM-DD. */
  serviceDate: string;
  setListId?: string | null;
  setListTitle?: string | null;
  arrangementId?: string | null;
  /** The key it was actually played in. */
  key?: string | null;
  /** RFC 3339. Filled in from the clock when it is not given. */
  shownAt?: string;
}

interface PresentationRow {
  id: string;
  origin: string;
  kind: string;
  title: string;
  theme_id: string | null;
  reference: string | null;
  last_used_at: string | null;
  in_library: number;
  archived_at: string | null;
}

interface SlideRow {
  id: string;
  presentation_id: string;
  sort_order: number;
  label: string | null;
  lines: string;
  notes: string | null;
}

function toSlide(row: SlideRow): PresentationSlide {
  return {
    id: row.id,
    presentationId: row.presentation_id,
    sortOrder: row.sort_order,
    label: row.label,
    lines: JSON.parse(row.lines) as string[],
    notes: row.notes,
  };
}

function toPresentation(row: PresentationRow, slides: PresentationSlide[]): Presentation {
  return {
    id: row.id,
    origin: row.origin === "hearth" ? "hearth" : "local",
    kind: row.kind as PresentationKind,
    title: row.title,
    slides,
    themeId: row.theme_id,
    reference: row.reference,
    lastUsedAt: row.last_used_at,
    inLibrary: row.in_library !== 0,
  };
}

/** Lines out of a stored JSON array, forgiving of a row that has none. */
function linesOf(stored: string | null): string[] {
  if (stored === null) return [];
  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter((line): line is string => typeof line === "string") : [];
  } catch {
    return [];
  }
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

/** A set list in a list of them: enough to pick next Sunday's (STG-46). */
export interface SetListSummary {
  id: string;
  title: string;
  date: string;
  entries: number;
  archived_at: string | null;
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

export interface PresentationSummary {
  id: string;
  title: string;
  kind: string;
  origin: "local" | "hearth";
  /** How many slides the room will see, at the default line limit. */
  slideCount: number;
  archivedAt: string | null;
  updatedAt: string;
  lastUsedAt: string | null;
}

/** What the library holds, as one list. A song and a set of slides are rows. */
export const LIBRARY_KINDS = ["song", "plain", "reading", "media"] as const;

export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  title: string;
  /** The author on a song. Null where there is nothing worth a second line. */
  subtitle: string | null;
  /** Sections on a song, slides on a presentation. */
  count: number;
  /** The first slide's words, for a tile that can be recognised at a glance. */
  preview: string[];
  /** The look it is presented in. Null takes the service's (ST8.1). */
  themeId: string | null;
  origin: "local" | "hearth";
  archivedAt: string | null;
  updatedAt: string;
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

  // Presentations (STG-145, ST2.16). Same two invariants as a song: validated
  // before the write, and `local` only.

  /**
   * Writes a presentation and its slides as one unit.
   *
   * Slides are replaced rather than merged, for the reason they are on a song:
   * the caller holds the whole thing, and a merge would need a second opinion
   * about what was deleted.
   */
  savePresentation(presentation: Presentation): void {
    const problems = validatePresentation(presentation);
    if (presentationHasErrors(problems)) {
      throw new LibraryError(
        `"${presentation.title}" cannot be saved: ${problems.filter((p) => p.severity === "error").length} problems.`,
        problems,
      );
    }

    if (presentation.origin !== "local") {
      throw new LibraryError(
        `"${presentation.title}" has origin "${presentation.origin}". The library holds what Stage owns, and a synced presentation belongs in the cache.`,
      );
    }

    const timestamp = this.now();

    this.db.transaction(() => {
      const existing = this.db
        .prepare("SELECT created_at FROM presentations WHERE id = ?")
        .get(presentation.id) as { created_at: string } | undefined;

      this.db
        .prepare(
          `INSERT INTO presentations
             (id, origin, kind, title, theme_id, reference, last_used_at, in_library, archived_at, created_at, updated_at)
           VALUES (
             @id, @origin, @kind, @title, @theme_id, @reference, @last_used_at, @in_library,
             COALESCE((SELECT archived_at FROM presentations WHERE id = @id), NULL),
             @created_at, @updated_at
           )
           ON CONFLICT(id) DO UPDATE SET
             kind = excluded.kind,
             title = excluded.title,
             theme_id = excluded.theme_id,
             reference = excluded.reference,
             last_used_at = excluded.last_used_at,
             in_library = excluded.in_library,
             updated_at = excluded.updated_at`,
        )
        .run({
          id: presentation.id,
          origin: presentation.origin,
          kind: presentation.kind,
          title: presentation.title,
          theme_id: presentation.themeId,
          reference: presentation.reference,
          last_used_at: presentation.lastUsedAt,
          in_library: presentation.inLibrary ? 1 : 0,
          created_at: existing?.created_at ?? timestamp,
          updated_at: timestamp,
        });

      this.db
        .prepare("DELETE FROM presentation_slides WHERE presentation_id = ?")
        .run(presentation.id);
      const slide = this.db.prepare(
        `INSERT INTO presentation_slides
           (id, presentation_id, sort_order, label, lines, notes)
         VALUES (@id, @presentation_id, @sort_order, @label, @lines, @notes)`,
      );
      for (const row of presentation.slides) {
        slide.run({
          id: row.id,
          presentation_id: row.presentationId,
          sort_order: row.sortOrder,
          label: row.label,
          lines: JSON.stringify(row.lines),
          notes: row.notes,
        });
      }
    })();

    this.afterWrite?.();
  }

  getPresentation(presentationId: string): Presentation | null {
    const row = this.db.prepare("SELECT * FROM presentations WHERE id = ?").get(presentationId) as
      | PresentationRow
      | undefined;
    if (row === undefined) return null;

    const slides = (
      this.db
        .prepare(
          "SELECT * FROM presentation_slides WHERE presentation_id = ? ORDER BY sort_order",
        )
        .all(presentationId) as SlideRow[]
    ).map(toSlide);

    return toPresentation(row, slides);
  }

  listPresentations(options: ListOptions = {}): PresentationSummary[] {
    const where = options.includeArchived === true ? "" : "WHERE archived_at IS NULL";
    const rows = this.db
      .prepare(
        `SELECT id, title, kind, origin, archived_at, updated_at, last_used_at
           FROM presentations
           ${where}
          ORDER BY updated_at DESC
          LIMIT ? OFFSET ?`,
      )
      .all(options.limit ?? 500, options.offset ?? 0) as {
      id: string;
      title: string;
      kind: string;
      origin: string;
      archived_at: string | null;
      updated_at: string;
      last_used_at: string | null;
    }[];

    return rows.map((row) => {
      // The count the room will see rather than the count typed, so a slide
      // that split in two is two here as well as on the wall.
      const whole = this.getPresentation(row.id);
      return {
        id: row.id,
        title: row.title,
        kind: row.kind,
        origin: row.origin === "hearth" ? "hearth" : "local",
        slideCount: whole === null ? 0 : slideCount(whole),
        archivedAt: row.archived_at,
        updatedAt: row.updated_at,
        lastUsedAt: row.last_used_at,
      };
    });
  }

  countPresentations(options: ListOptions = {}): number {
    const where = options.includeArchived === true ? "" : "WHERE archived_at IS NULL";
    const row = this.db
      .prepare(`SELECT COUNT(*) AS n FROM presentations ${where}`)
      .get() as { n: number };
    return row.n;
  }

  /** Out of every list, and kept. The rule across the whole product. */
  archivePresentation(presentationId: string): boolean {
    const result = this.db
      .prepare(
        "UPDATE presentations SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL",
      )
      .run(this.now(), this.now(), presentationId);
    if (result.changes > 0) this.afterWrite?.();
    return result.changes > 0;
  }

  restorePresentation(presentationId: string): boolean {
    const result = this.db
      .prepare("UPDATE presentations SET archived_at = NULL, updated_at = ? WHERE id = ?")
      .run(this.now(), presentationId);
    if (result.changes > 0) this.afterWrite?.();
    return result.changes > 0;
  }

  /**
   * The library as one list (STG-146, ST2.16).
   *
   * A song and a set of typed slides are the same kind of thing to the person
   * looking for them: something to put on the screen. Two lists would mean
   * knowing which one a thing is in before looking for it, and nobody knows
   * that about the notices.
   *
   * One query across both tables, because sorting two lists in the renderer
   * would put the paging in the wrong place once a library has two hundred
   * rows.
   */
  items(options: ListOptions = {}): LibraryItem[] {
    const all = options.includeArchived === true;
    const rows = this.db
      .prepare(
        `SELECT id, kind, title, subtitle, count, preview, theme_id, origin, archived_at, updated_at FROM (
           SELECT s.id         AS id,
                  'song'       AS kind,
                  s.title      AS title,
                  s.author     AS subtitle,
                  (SELECT COUNT(*) FROM song_sections c WHERE c.song_id = s.id) AS count,
                  (SELECT c.lines FROM song_sections c WHERE c.song_id = s.id
                    ORDER BY c.sort_order LIMIT 1) AS preview,
                  NULL         AS theme_id,
                  s.origin     AS origin,
                  s.archived_at AS archived_at,
                  s.updated_at AS updated_at
             FROM songs s
           UNION ALL
           SELECT p.id         AS id,
                  p.kind       AS kind,
                  p.title      AS title,
                  NULL         AS subtitle,
                  (SELECT COUNT(*) FROM presentation_slides d WHERE d.presentation_id = p.id) AS count,
                  (SELECT d.lines FROM presentation_slides d WHERE d.presentation_id = p.id
                    ORDER BY d.sort_order LIMIT 1) AS preview,
                  p.theme_id   AS theme_id,
                  p.origin     AS origin,
                  p.archived_at AS archived_at,
                  p.updated_at AS updated_at
             FROM presentations p
            WHERE p.in_library = 1
         )
         ${all ? "" : "WHERE archived_at IS NULL"}
         ORDER BY title COLLATE NOCASE
         LIMIT ? OFFSET ?`,
      )
      .all(options.limit ?? 500, options.offset ?? 0) as {
      id: string;
      kind: string;
      title: string;
      subtitle: string | null;
      count: number;
      preview: string | null;
      theme_id: string | null;
      origin: string;
      archived_at: string | null;
      updated_at: string;
    }[];

    return rows.map((row) => ({
      id: row.id,
      kind: (LIBRARY_KINDS as readonly string[]).includes(row.kind)
        ? (row.kind as LibraryKind)
        : "plain",
      title: row.title,
      subtitle: row.subtitle,
      count: row.count,
      preview: linesOf(row.preview),
      themeId: row.theme_id,
      origin: row.origin === "hearth" ? "hearth" : "local",
      archivedAt: row.archived_at,
      updatedAt: row.updated_at,
    }));
  }

  /** Every presentation whole, for the deck compiler's lookup. */
  allPresentations(options: ListOptions = {}): Presentation[] {
    return this.listPresentations(options)
      .map((summary) => this.getPresentation(summary.id))
      .filter((one): one is Presentation => one !== null);
  }
  /**
   * STG-46, ST2.8. The running order a church types for one service.
   *
   * Written as one unit, entries and all, the same way a song is: a set list
   * half saved is a service half planned, and the order is what somebody is
   * holding when they walk to the desk.
   */
  saveSetList(list: SetList): void {
    const problems = validateSetList(list);
    if (setListHasErrors(problems)) {
      throw new LibraryError(
        `"${list.title}" cannot be stored: ${problems.map((one) => one.code).join(", ")}.`,
      );
    }

    const timestamp = this.now();

    this.db.transaction(() => {
      const existing = this.db
        .prepare("SELECT created_at FROM set_lists WHERE id = ?")
        .get(list.id) as { created_at: string } | undefined;

      this.db
        .prepare(
          `INSERT INTO set_lists (id, title, date, archived_at, created_at, updated_at)
           VALUES (@id, @title, @date, NULL, @created_at, @updated_at)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             date = excluded.date,
             updated_at = excluded.updated_at`,
        )
        .run({
          id: list.id,
          title: list.title.trim(),
          date: list.date,
          created_at: existing?.created_at ?? timestamp,
          updated_at: timestamp,
        });

      // Replaced rather than merged, for the same reason a song's sections are:
      // what is on the screen is the whole order, so the whole order is written.
      this.db.prepare("DELETE FROM set_entries WHERE set_list_id = ?").run(list.id);
      const entry = this.db.prepare(
        `INSERT INTO set_entries (id, set_list_id, sort_order, kind, item_id, title, notes)
         VALUES (@id, @set_list_id, @sort_order, @kind, @item_id, @title, @notes)`,
      );
      orderedEntries(list).forEach((one, index) => {
        entry.run({
          // Numbered by position within this order rather than taken from the
          // caller. An entry has nothing hanging off it, so its identity is
          // where it sits, and two orders cannot collide on an id a window
          // made up.
          id: `${list.id}:entry:${index}`,
          set_list_id: list.id,
          sort_order: index,
          kind: one.kind,
          item_id: one.itemId,
          title: one.title.trim(),
          notes: one.notes,
        });
      });
    })();

    this.afterWrite?.();
  }

  getSetList(setListId: string): SetList | null {
    const row = this.db.prepare("SELECT * FROM set_lists WHERE id = ?").get(setListId) as
      | { id: string; title: string; date: string; updated_at: string }
      | undefined;
    if (row === undefined) return null;

    const entries = (
      this.db
        .prepare("SELECT * FROM set_entries WHERE set_list_id = ? ORDER BY sort_order")
        .all(setListId) as {
        id: string;
        set_list_id: string;
        sort_order: number;
        kind: string;
        item_id: string | null;
        title: string;
        notes: string | null;
      }[]
    ).map(
      (one): SetEntry => ({
        id: one.id,
        setListId: one.set_list_id,
        sortOrder: one.sort_order,
        kind: one.kind === "marker" ? "marker" : "item",
        itemId: one.item_id,
        title: one.title,
        notes: one.notes,
      }),
    );

    return { id: row.id, title: row.title, date: row.date, entries, updatedAt: row.updated_at };
  }

  /** Every set list, newest service first, which is how a church looks. */
  setLists(options: ListOptions = {}): SetListSummary[] {
    const all = options.includeArchived === true;
    return this.db
      .prepare(
        `SELECT s.id, s.title, s.date, s.archived_at,
                (SELECT COUNT(*) FROM set_entries e WHERE e.set_list_id = s.id) AS entries
           FROM set_lists s
           ${all ? "" : "WHERE s.archived_at IS NULL"}
           ORDER BY s.date DESC, s.title COLLATE NOCASE
           LIMIT ? OFFSET ?`,
      )
      .all(options.limit ?? 200, options.offset ?? 0) as SetListSummary[];
  }

  /** Puts one away. Nothing is deleted, the same as everywhere else. */
  archiveSetList(setListId: string): boolean {
    const done = this.db
      .prepare("UPDATE set_lists SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL")
      .run(this.now(), this.now(), setListId);
    if (done.changes > 0) this.afterWrite?.();
    return done.changes > 0;
  }

  /** Which table a library item is in, for `setListPlan`. */
  /**
   * Writes that a song went on the wall (STG-52, ST2.10).
   *
   * Idempotent per song per service, because the operator going back to the
   * chorus is the same use and a report that counted it twice would be wrong.
   * The song's name and CCLI number are copied in rather than joined, so a
   * report run next year still names what was sung after somebody archives it.
   *
   * Also moves the song's `last_used_at`, which is what the library sorts on.
   */
  logUsage(use: SongUse): boolean {
    const timestamp = use.shownAt ?? this.now();
    const written = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `INSERT INTO song_usage
             (id, song_id, title, author, ccli_number, service_date,
              set_list_id, set_list_title, arrangement_id, song_key, shown_at)
           VALUES (@id, @song_id, @title, @author, @ccli_number, @service_date,
                   @set_list_id, @set_list_title, @arrangement_id, @song_key, @shown_at)
           ON CONFLICT DO NOTHING`,
        )
        .run({
          id: `use:${use.songId}:${use.serviceDate}:${use.setListId ?? ""}`,
          song_id: use.songId,
          title: use.title,
          author: use.author ?? null,
          ccli_number: use.ccliNumber ?? null,
          service_date: use.serviceDate,
          set_list_id: use.setListId ?? null,
          set_list_title: use.setListTitle ?? null,
          arrangement_id: use.arrangementId ?? null,
          song_key: use.key ?? null,
          shown_at: timestamp,
        });

      if (result.changes === 0) return false;
      this.db
        .prepare("UPDATE songs SET last_used_at = ?, updated_at = ? WHERE id = ?")
        .run(timestamp, timestamp, use.songId);
      return true;
    })();

    if (written) this.afterWrite?.();
    return written;
  }

  /**
   * The log, for a period (STG-52, STG-53, ST2.11).
   *
   * Both ends are inclusive, because a church asked for January to June means
   * the whole of June. Ordered by date, which is the order a report reads in.
   */
  usage(period: { from?: string; to?: string } = {}): SongUse[] {
    const where: string[] = [];
    const values: string[] = [];
    if (period.from !== undefined) {
      where.push("service_date >= ?");
      values.push(period.from);
    }
    if (period.to !== undefined) {
      where.push("service_date <= ?");
      values.push(period.to);
    }

    const rows = this.db
      .prepare(
        `SELECT * FROM song_usage
          ${where.length === 0 ? "" : `WHERE ${where.join(" AND ")}`}
          ORDER BY service_date, title COLLATE NOCASE`,
      )
      .all(...values) as {
      song_id: string;
      title: string;
      author: string | null;
      ccli_number: string | null;
      service_date: string;
      set_list_id: string | null;
      set_list_title: string | null;
      arrangement_id: string | null;
      song_key: string | null;
      shown_at: string;
    }[];

    return rows.map((row) => ({
      songId: row.song_id,
      title: row.title,
      author: row.author,
      ccliNumber: row.ccli_number,
      serviceDate: row.service_date,
      setListId: row.set_list_id,
      setListTitle: row.set_list_title,
      arrangementId: row.arrangement_id,
      key: row.song_key,
      shownAt: row.shown_at,
    }));
  }

  /** Writes a collection, keeping whatever is already in it. */
  saveCollection(collection: { id: string; name: string; sortOrder?: number }): void {
    const timestamp = this.now();
    this.db
      .prepare(
        `INSERT INTO collections (id, name, sort_order, archived_at, created_at, updated_at)
         VALUES (
           @id, @name, @sort_order,
           COALESCE((SELECT archived_at FROM collections WHERE id = @id), NULL),
           COALESCE((SELECT created_at FROM collections WHERE id = @id), @now),
           @now
         )
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           sort_order = excluded.sort_order,
           updated_at = excluded.updated_at`,
      )
      .run({
        id: collection.id,
        name: collection.name.trim(),
        sort_order: collection.sortOrder ?? 0,
        now: timestamp,
      });
    this.afterWrite?.();
  }

  /** Every collection, with how much is in each. */
  collections(options: ListOptions = {}): Collection[] {
    const where = options.includeArchived === true ? "" : "WHERE c.archived_at IS NULL";
    const rows = this.db
      .prepare(
        `SELECT c.id AS id, c.name AS name, c.sort_order AS sort_order,
                (SELECT COUNT(*) FROM collection_items i WHERE i.collection_id = c.id) AS items
           FROM collections c
           ${where}
          ORDER BY c.sort_order, c.name COLLATE NOCASE`,
      )
      .all() as { id: string; name: string; sort_order: number; items: number }[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order,
      items: row.items,
    }));
  }

  /**
   * Puts a library item in a collection, or takes it out.
   *
   * Idempotent either way, because the window sends what it wants to be true
   * rather than what it believes is currently true.
   */
  setInCollection(collectionId: string, itemId: string, inIt: boolean): void {
    if (inIt) {
      this.db
        .prepare(
          `INSERT INTO collection_items (collection_id, item_id, sort_order)
           VALUES (?, ?, (SELECT COUNT(*) FROM collection_items WHERE collection_id = ?))
           ON CONFLICT DO NOTHING`,
        )
        .run(collectionId, itemId, collectionId);
    } else {
      this.db
        .prepare("DELETE FROM collection_items WHERE collection_id = ? AND item_id = ?")
        .run(collectionId, itemId);
    }
    this.afterWrite?.();
  }

  /** The collections one item is in. */
  collectionsOf(itemId: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT i.collection_id AS id
           FROM collection_items i
           JOIN collections c ON c.id = i.collection_id
          WHERE i.item_id = ? AND c.archived_at IS NULL
          ORDER BY c.sort_order, c.name COLLATE NOCASE`,
      )
      .all(itemId) as { id: string }[];
    return rows.map((row) => row.id);
  }

  /** The library items in one collection. */
  itemsInCollection(collectionId: string): string[] {
    const rows = this.db
      .prepare(
        "SELECT item_id AS id FROM collection_items WHERE collection_id = ? ORDER BY sort_order",
      )
      .all(collectionId) as { id: string }[];
    return rows.map((row) => row.id);
  }

  /** Takes a collection off the list. What was in it is untouched. */
  archiveCollection(collectionId: string): boolean {
    const timestamp = this.now();
    const result = this.db
      .prepare(
        "UPDATE collections SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL",
      )
      .run(timestamp, timestamp, collectionId);
    if (result.changes > 0) this.afterWrite?.();
    return result.changes > 0;
  }

  /**
   * Writes a media row, keeping where it came from.
   *
   * The file is copied into the profile by the caller, because this package
   * owns the database and not the disk around it.
   */
  saveMedia(media: {
    id: string;
    kind: MediaFileKind;
    name: string;
    file: string;
    mime: string;
    bytes: number;
    hash?: string | null;
  }): void {
    const timestamp = this.now();
    this.db
      .prepare(
        `INSERT INTO media (id, kind, name, file, mime, bytes, content_hash, archived_at, created_at, updated_at)
         VALUES (
           @id, @kind, @name, @file, @mime, @bytes, @hash,
           COALESCE((SELECT archived_at FROM media WHERE id = @id), NULL),
           COALESCE((SELECT created_at FROM media WHERE id = @id), @now),
           @now
         )
         ON CONFLICT(id) DO UPDATE SET
           kind = excluded.kind,
           name = excluded.name,
           file = excluded.file,
           mime = excluded.mime,
           bytes = excluded.bytes,
           content_hash = excluded.content_hash,
           updated_at = excluded.updated_at`,
      )
      .run({
        id: media.id,
        kind: media.kind,
        name: media.name.trim(),
        file: media.file,
        mime: media.mime,
        bytes: media.bytes,
        hash: media.hash ?? null,
        now: timestamp,
      });
    this.afterWrite?.();
  }

  /** The media shelf, newest first, because the last thing added is wanted. */
  media(options: ListOptions & { kind?: MediaFileKind } = {}): MediaItem[] {
    const terms: string[] = [];
    if (options.includeArchived !== true) terms.push("archived_at IS NULL");
    if (options.kind !== undefined) terms.push("kind = @kind");
    const where = terms.length === 0 ? "" : `WHERE ${terms.join(" AND ")}`;
    const rows = this.db
      .prepare(`SELECT * FROM media ${where} ORDER BY created_at DESC, name COLLATE NOCASE`)
      .all({ kind: options.kind ?? null }) as MediaRecord[];
    return rows.map(asMedia);
  }

  /**
   * The row for a file's contents (STG-152, ST9.11).
   *
   * The hash is what the file is, so this is how a reference resolves and how
   * a second add of the same photograph finds the first one. Archived rows
   * answer too: adding a file somebody took off the shelf is a way of putting
   * it back, and a second copy of the same bytes is not what they meant.
   */
  mediaByHash(hash: string): MediaItem | null {
    const row = this.db.prepare("SELECT * FROM media WHERE content_hash = ?").get(hash) as
      | MediaRecord
      | undefined;
    return row === undefined ? null : asMedia(row);
  }

  /** Back onto the shelf, with everything it had. */
  restoreMedia(mediaId: string): boolean {
    const timestamp = this.now();
    const result = this.db
      .prepare(
        "UPDATE media SET archived_at = NULL, updated_at = ? WHERE id = ? AND archived_at IS NOT NULL",
      )
      .run(timestamp, mediaId);
    if (result.changes > 0) this.afterWrite?.();
    return result.changes > 0;
  }

  /** Rows written before the hash was the identity, for main to fill in. */
  mediaWithoutHash(): MediaItem[] {
    const rows = this.db
      .prepare("SELECT * FROM media WHERE content_hash IS NULL")
      .all() as MediaRecord[];
    return rows.map(asMedia);
  }

  getMedia(mediaId: string): MediaItem | null {
    const row = this.db.prepare("SELECT * FROM media WHERE id = ?").get(mediaId) as
      | MediaRecord
      | undefined;
    return row === undefined ? null : asMedia(row);
  }

  /** What a church calls it. The file on disk keeps the name it was given. */
  renameMedia(mediaId: string, name: string): boolean {
    const trimmed = name.trim();
    if (trimmed === "") return false;
    const timestamp = this.now();
    const result = this.db
      .prepare("UPDATE media SET name = ?, updated_at = ? WHERE id = ?")
      .run(trimmed, timestamp, mediaId);
    if (result.changes > 0) this.afterWrite?.();
    return result.changes > 0;
  }

  /** Takes it off the shelf. The copied file is the caller's to remove. */
  archiveMedia(mediaId: string): boolean {
    const timestamp = this.now();
    const result = this.db
      .prepare("UPDATE media SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL")
      .run(timestamp, timestamp, mediaId);
    if (result.changes > 0) this.afterWrite?.();
    return result.changes > 0;
  }

  countMedia(options: ListOptions & { kind?: MediaFileKind } = {}): number {
    return this.media(options).length;
  }

  kindOf(itemId: string): ItemKind | undefined {
    const song = this.db.prepare("SELECT 1 FROM songs WHERE id = ?").get(itemId);
    if (song !== undefined) return "song";
    const presentation = this.db.prepare("SELECT 1 FROM presentations WHERE id = ?").get(itemId);
    return presentation === undefined ? undefined : "presentation";
  }
}

interface MediaRecord {
  id: string;
  kind: MediaFileKind;
  name: string;
  file: string;
  mime: string;
  bytes: number;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
}

function asMedia(row: MediaRecord): MediaItem {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    file: row.file,
    mime: row.mime,
    bytes: row.bytes,
    hash: row.content_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
