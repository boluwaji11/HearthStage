/**
 * STG-1. Whether a song is well formed.
 *
 * Three callers, and they are the reason this returns data rather than throwing
 * or rendering a sentence:
 *
 * - **An importer** reading 300 songs out of a ProPresenter library, which needs
 *   a report naming what came in badly rather than a stack trace on song 41
 *   (ST3.3).
 * - **The deck compiler**, which must fail loudly on a sequence referring to a
 *   section that does not exist, at compile time rather than at 10:31 on a
 *   Sunday (ST5.2).
 * - **A form**, where somebody typed a song in.
 *
 * Problems carry a code and the values that explain them. They are never
 * sentences, because a sentence shown to a person belongs in `packages/i18n`
 * and this package has no dependencies. Whoever displays a problem maps its
 * code to a catalogue key.
 */

import { isKey, isTimeSignature } from "./keys";
import { SECTION_TYPES, type WholeSong } from "./types";

export type Severity = "error" | "warning";

/**
 * `error` means nothing can present this song. `warning` means it presents and
 * something about it is wrong, which is the usual state of an imported library.
 */
export type SongProblem =
  | { code: "title.missing"; severity: "error" }
  | { code: "primaryLanguage.invalid"; severity: "error"; value: string }
  | { code: "timeSignature.invalid"; severity: "warning"; value: string }
  | { code: "ccliNumber.invalid"; severity: "warning"; value: string }
  | { code: "year.implausible"; severity: "warning"; value: number }
  | { code: "defaultKey.invalid"; severity: "warning"; value: string }
  | { code: "sections.none"; severity: "error" }
  | { code: "section.label.missing"; severity: "error"; sectionId: string }
  | { code: "section.label.duplicate"; severity: "error"; label: string }
  | { code: "section.type.unknown"; severity: "error"; label: string; value: string }
  | { code: "section.lines.empty"; severity: "error"; label: string }
  | { code: "section.lines.containsNewline"; severity: "error"; label: string; line: number }
  | { code: "section.sortOrder.duplicate"; severity: "warning"; sortOrder: number }
  | { code: "section.language.invalid"; severity: "error"; label: string; value: string }
  | { code: "section.translationOf.unknown"; severity: "error"; label: string; target: string }
  | { code: "section.translationOf.notPrimary"; severity: "error"; label: string }
  | { code: "section.translationOf.sameLanguage"; severity: "error"; label: string }
  | { code: "arrangements.none"; severity: "error" }
  | { code: "arrangement.name.missing"; severity: "error"; arrangementId: string }
  | { code: "arrangement.name.duplicate"; severity: "warning"; name: string }
  | { code: "arrangement.key.invalid"; severity: "error"; name: string; value: string }
  | { code: "arrangement.sequence.empty"; severity: "error"; name: string }
  | { code: "arrangement.sequence.unknownLabel"; severity: "error"; name: string; label: string }
  | { code: "arrangement.song.mismatch"; severity: "error"; arrangementId: string }
  | { code: "section.song.mismatch"; severity: "error"; sectionId: string }
  | { code: "arrangements.noDefault"; severity: "warning" }
  | { code: "arrangements.manyDefaults"; severity: "warning"; count: number }
  | { code: "media.arrangement.unknown"; severity: "warning"; mediaId: string };

export type SongProblemCode = SongProblem["code"];

/** ISO 639-1 is two letters. A region suffix is accepted and ignored. */
const LANGUAGE = /^[a-z]{2}(-[A-Za-z]{2,8})?$/;

/** CCLI song numbers are digits. Length has grown over the years, so it is loose. */
const CCLI_NUMBER = /^[0-9]{1,12}$/;

const SECTION_TYPE_SET = new Set<string>(SECTION_TYPES);

/**
 * Every problem with a song, in the order they were found.
 *
 * The whole song is checked rather than stopping at the first problem, because
 * an import report that names one of eleven faults sends somebody round the
 * loop eleven times.
 */
export function validateWholeSong(whole: WholeSong): SongProblem[] {
  const { song, sections, arrangements, media } = whole;
  const problems: SongProblem[] = [];

  if (song.title.trim() === "") {
    problems.push({ code: "title.missing", severity: "error" });
  }
  if (!LANGUAGE.test(song.primaryLanguage)) {
    problems.push({
      code: "primaryLanguage.invalid",
      severity: "error",
      value: song.primaryLanguage,
    });
  }
  if (song.timeSignature !== null && !isTimeSignature(song.timeSignature)) {
    problems.push({ code: "timeSignature.invalid", severity: "warning", value: song.timeSignature });
  }
  if (song.ccliNumber !== null && !CCLI_NUMBER.test(song.ccliNumber)) {
    problems.push({ code: "ccliNumber.invalid", severity: "warning", value: song.ccliNumber });
  }
  // Hymns reach back centuries and nothing is written for next year, so the
  // window is wide and only catches a field somebody filled with a duration.
  if (song.year !== null && (song.year < 1000 || song.year > new Date().getFullYear() + 1)) {
    problems.push({ code: "year.implausible", severity: "warning", value: song.year });
  }
  if (song.defaultKey !== null && !isKey(song.defaultKey)) {
    problems.push({ code: "defaultKey.invalid", severity: "warning", value: song.defaultKey });
  }

  if (sections.length === 0) {
    problems.push({ code: "sections.none", severity: "error" });
  }

  const byLabel = new Map<string, (typeof sections)[number]>();
  const seenSortOrder = new Set<number>();

  for (const section of sections) {
    if (section.songId !== song.id) {
      problems.push({ code: "section.song.mismatch", severity: "error", sectionId: section.id });
    }

    const label = section.label.trim();
    if (label === "") {
      problems.push({ code: "section.label.missing", severity: "error", sectionId: section.id });
    } else if (byLabel.has(label)) {
      problems.push({ code: "section.label.duplicate", severity: "error", label });
    } else {
      byLabel.set(label, section);
    }

    if (!SECTION_TYPE_SET.has(section.sectionType)) {
      problems.push({
        code: "section.type.unknown",
        severity: "error",
        label,
        value: section.sectionType,
      });
    }

    if (section.lines.length === 0 || section.lines.every((line) => line.trim() === "")) {
      problems.push({ code: "section.lines.empty", severity: "error", label });
    }

    // The guard on R12.4. A section holding one string with newlines in it is a
    // blob wearing an array, and it is how a "good enough" song list becomes a
    // rewrite. Caught here rather than discovered by the renderer.
    section.lines.forEach((line, index) => {
      if (/[\r\n]/.test(line)) {
        problems.push({
          code: "section.lines.containsNewline",
          severity: "error",
          label,
          line: index,
        });
      }
    });

    if (!LANGUAGE.test(section.language)) {
      problems.push({
        code: "section.language.invalid",
        severity: "error",
        label,
        value: section.language,
      });
    }

    if (seenSortOrder.has(section.sortOrder)) {
      problems.push({
        code: "section.sortOrder.duplicate",
        severity: "warning",
        sortOrder: section.sortOrder,
      });
    }
    seenSortOrder.add(section.sortOrder);
  }

  // Translation alignment, checked once every section is known (R12.8). A
  // translated section points at a primary-language section, and the pair are
  // in different languages, otherwise a bilingual slide renders one language
  // twice.
  const byId = new Map(sections.map((section) => [section.id, section]));
  for (const section of sections) {
    if (section.translationOf === null) continue;
    const target = byId.get(section.translationOf);
    if (target === undefined) {
      problems.push({
        code: "section.translationOf.unknown",
        severity: "error",
        label: section.label,
        target: section.translationOf,
      });
      continue;
    }
    if (target.language !== song.primaryLanguage) {
      problems.push({
        code: "section.translationOf.notPrimary",
        severity: "error",
        label: section.label,
      });
    }
    if (target.language === section.language) {
      problems.push({
        code: "section.translationOf.sameLanguage",
        severity: "error",
        label: section.label,
      });
    }
  }

  if (arrangements.length === 0) {
    problems.push({ code: "arrangements.none", severity: "error" });
  }

  const seenName = new Set<string>();
  let defaults = 0;

  for (const arrangement of arrangements) {
    if (arrangement.songId !== song.id) {
      problems.push({
        code: "arrangement.song.mismatch",
        severity: "error",
        arrangementId: arrangement.id,
      });
    }

    const name = arrangement.name.trim();
    if (name === "") {
      problems.push({
        code: "arrangement.name.missing",
        severity: "error",
        arrangementId: arrangement.id,
      });
    } else if (seenName.has(name)) {
      problems.push({ code: "arrangement.name.duplicate", severity: "warning", name });
    } else {
      seenName.add(name);
    }

    if (!isKey(arrangement.key)) {
      problems.push({
        code: "arrangement.key.invalid",
        severity: "error",
        name,
        value: arrangement.key,
      });
    }

    if (arrangement.sequence.length === 0) {
      problems.push({ code: "arrangement.sequence.empty", severity: "error", name });
    }

    // The acceptance criterion on R12.4, and the one that matters most. A
    // sequence naming a section the song does not have is a hole in the service.
    for (const label of arrangement.sequence) {
      if (!byLabel.has(label.trim())) {
        problems.push({
          code: "arrangement.sequence.unknownLabel",
          severity: "error",
          name,
          label,
        });
      }
    }

    if (arrangement.isDefault) defaults += 1;
  }

  if (arrangements.length > 0 && defaults === 0) {
    problems.push({ code: "arrangements.noDefault", severity: "warning" });
  }
  if (defaults > 1) {
    problems.push({ code: "arrangements.manyDefaults", severity: "warning", count: defaults });
  }

  const arrangementIds = new Set(arrangements.map((arrangement) => arrangement.id));
  for (const item of media) {
    if (!arrangementIds.has(item.arrangementId)) {
      problems.push({ code: "media.arrangement.unknown", severity: "warning", mediaId: item.id });
    }
  }

  return problems;
}

/** Whether anything found would stop the song being presented. */
export function hasErrors(problems: SongProblem[]): boolean {
  return problems.some((problem) => problem.severity === "error");
}

export function errorsOnly(problems: SongProblem[]): SongProblem[] {
  return problems.filter((problem) => problem.severity === "error");
}
