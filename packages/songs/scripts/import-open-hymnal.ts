/**
 * STG-10. The bundled hymns, built from the Open Hymnal Project.
 *
 * Run once, by hand, with the project's ABC archive unpacked somewhere:
 *
 *     pnpm --filter @hearth/songs hymns ~/Downloads/openhymnal
 *
 * It writes `src/hymns.json`, which is committed and shipped. Nothing in the
 * application reaches the network, and this script is not part of the build.
 *
 * **Only hymns whose words are public domain.** Each ABC file carries its own
 * copyright line, stating the status of the words, the music, the translation
 * and the setting separately. A file whose line is not one of the two that put
 * the words in the public domain is skipped, whatever else it says. Stage ships
 * no copyrighted lyrics (PRD section 4), so this is the whole point of the
 * script rather than a detail of it.
 *
 * **A hymn that does not come out cleanly is skipped.** The lyrics live under
 * the music as syllables, and they are put back together using the hymn's own
 * metre: `10 10 10 10` means four lines of ten syllables. Where the syllables
 * and the metre disagree the hymn is left out, because a hymn broken in the
 * wrong place is worse on a wall than a hymn that is not there.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** A hymn as it is shipped. The model builds the records from this. */
export interface BundledHymn {
  id: string;
  title: string;
  author: string | null;
  year: number | null;
  key: string | null;
  timeSignature: string | null;
  metre: string | null;
  themes: string[];
  /** Each verse, as the lines it is sung in. */
  verses: string[][];
}

/** The two copyright lines that put the words in the public domain. */
function wordsArePublicDomain(lines: string[]): boolean {
  for (const line of lines) {
    const match = /^C:\s*copyright:\s*(.*)$/i.exec(line);
    if (match === null) continue;
    const terms = (match[1] ?? "").trim().toLowerCase();
    if (terms.startsWith("public domain")) return true;
    if (terms.startsWith("words, public domain")) return true;
    if (terms.startsWith("words: public domain")) return true;
  }
  return false;
}

function headerOf(lines: string[], prefix: string): string | null {
  for (const line of lines) {
    if (line.startsWith(prefix)) return line.slice(prefix.length).trim();
  }
  return null;
}

/**
 * The syllables under the music, one list per verse.
 *
 * A run of `w:` lines belongs to the music line above it, and the nth line of
 * the run is the nth verse. A verse number on the front of the first syllable
 * is a label rather than a syllable.
 */
function versesOf(lines: string[]): string[][] {
  const verses: string[][] = [];
  let runStart = 0;
  let atRun = 0;
  let inRun = false;

  for (const line of lines) {
    if (!line.startsWith("w:")) {
      inRun = false;
      continue;
    }

    const body = line.slice(2).trim();
    const numbered = /^(\d+)\./.exec(body);
    if (!inRun) {
      // A run starts where its first line says it does. A hymn of ten verses
      // sets five under the music and five under it again, so the second run
      // starts at six and the position in the run is no longer the verse.
      runStart = numbered === null ? 0 : Number(numbered[1]) - 1;
      atRun = 0;
      inRun = true;
    }

    const index = numbered === null ? runStart + atRun : Number(numbered[1]) - 1;
    atRun += 1;
    const words = (verses[index] ??= []);

    for (const raw of body.split(/\s+/)) {
      // `*` is a note with no syllable and `_` holds the one before it. Both
      // turn up stuck to a syllable as well as on their own.
      const token = raw.replace(/^\d+\.~?/, "").replace(/[*_|]/g, "");
      if (token === "" || token === "-") continue;
      words.push(token);
    }
  }

  return verses.filter((verse) => verse !== undefined && verse.length > 0);
}

/**
 * Syllables back into words.
 *
 * A syllable ending in `-` joins to the one after it. `~` is a hard space, so a
 * note carrying two words gives two words back. `\` is an escape the format
 * uses before punctuation.
 */
function wordsFrom(syllables: string[]): string[] {
  const out: string[] = [];
  let building = "";

  for (const raw of syllables) {
    const syllable = raw.replace(/\\/g, "").replace(/~/g, " ");
    if (syllable.endsWith("-")) {
      building += syllable.slice(0, -1);
      continue;
    }
    out.push(building + syllable);
    building = "";
  }
  if (building !== "") out.push(building);

  return out;
}

/** `8 6 8 6 D` into the line lengths it means. */
function metreOf(metre: string | null): number[] | null {
  if (metre === null) return null;
  const cleaned = metre.replace(/[().]/g, " ").trim();
  const counts: number[] = [];
  let doubled = false;

  for (const part of cleaned.split(/[\s,]+/)) {
    if (part === "") continue;
    if (/^\d+$/.test(part)) {
      counts.push(Number(part));
      continue;
    }
    if (part.toUpperCase() === "D") {
      doubled = true;
      continue;
    }
    // "with refrain", "Irregular", anything else. The metre no longer says
    // where the lines fall, so the hymn is left for somebody to type.
    return null;
  }

  if (counts.length === 0) return null;
  return doubled ? [...counts, ...counts] : counts;
}

/**
 * The lines of one verse, cut where the metre says.
 *
 * The metre is a count of syllables per line, and a syllable here is a note, so
 * the two agree on a well formed hymn. A verse running to two or three times
 * the metre is the pattern repeating, which a long hymn does.
 */
function linesOf(syllables: string[], counts: number[]): string[] | null {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0 || syllables.length % total !== 0) return null;

  const words = wordsFrom(syllables);
  // Joining syllables changes nothing about where the lines fall, because a
  // joined word ends on the note its last syllable sits on.
  const ends: number[] = [];
  let seen = 0;
  for (const raw of syllables) {
    if (!raw.endsWith("-")) seen += 1;
    ends.push(seen);
  }

  const lines: string[] = [];
  let at = 0;
  let taken = 0;
  while (taken < syllables.length) {
    for (const count of counts) {
      const upTo = ends[Math.min(taken + count, syllables.length) - 1] ?? words.length;
      const line = words.slice(at, upTo).join(" ").trim();
      if (line !== "") lines.push(line);
      at = upTo;
      taken += count;
      if (taken >= syllables.length) break;
    }
  }

  return lines.length === 0 ? null : lines;
}

function yearOf(credit: string | null): number | null {
  if (credit === null) return null;
  const match = /\b(1[0-9]{3}|20[0-2][0-9])\b/.exec(credit);
  return match === null ? null : Number(match[1]);
}

/** "Lyte, Henry F. (1793-1847)" reads as a person on a screen. */
function personOf(entry: string | null): string | null {
  if (entry === null || entry.toLowerCase() === "none") return null;
  const withoutDates = entry.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const comma = withoutDates.indexOf(",");
  if (comma === -1) return withoutDates === "" ? null : withoutDates;
  const family = withoutDates.slice(0, comma).trim();
  const given = withoutDates.slice(comma + 1).trim();
  return given === "" ? family : `${given} ${family}`;
}

function idOf(title: string): string {
  return `hymn-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

function topicsOf(entry: string | null): string[] {
  if (entry === null) return [];
  return [...entry.matchAll(/\{([^}]+)\}/g)]
    .map((match) => (match[1] ?? "").replace(/\[[^\]]*\]/g, "").trim().toLowerCase())
    .filter((topic) => topic !== "")
    .slice(0, 6);
}

export function hymnFrom(source: string): BundledHymn | null {
  const lines = source.split(/\r\n|\r|\n/).map((line) => line.trim());
  if (!wordsArePublicDomain(lines)) return null;

  const title = headerOf(lines, "T:");
  if (title === null || title === "") return null;

  const counts = metreOf(headerOf(lines, "%OHMETRICAL"));
  if (counts === null) return null;

  const verses: string[][] = [];
  for (const syllables of versesOf(lines)) {
    const built = linesOf(syllables, counts);
    // One verse that will not come out cleanly makes the whole hymn suspect.
    if (built === null) return null;
    verses.push(built);
  }
  if (verses.length === 0) return null;

  const credit = lines.find((line) => /^C:\s*Words:/i.test(line)) ?? null;

  return {
    id: idOf(title),
    title,
    author: personOf(headerOf(lines, "%OHAUTHOR")),
    year: yearOf(credit),
    key: (headerOf(lines, "K:") ?? "").split(/\s|%/)[0] || null,
    timeSignature: (headerOf(lines, "M:") ?? "").split(/\s|%/)[0] || null,
    metre: headerOf(lines, "%OHMETRICAL"),
    themes: topicsOf(headerOf(lines, "%OHTOPICS")),
    verses,
  };
}

function main(): void {
  const from = process.argv[2];
  if (from === undefined) {
    console.error("Give it the folder holding the Open Hymnal ABC files.");
    process.exit(1);
  }

  const files = readdirSync(from).filter((name) => name.endsWith(".abc"));
  const hymns: BundledHymn[] = [];
  const skipped: string[] = [];

  for (const name of files.sort()) {
    const hymn = hymnFrom(readFileSync(join(from, name), "utf8"));
    if (hymn === null) skipped.push(name);
    else hymns.push(hymn);
  }

  const seen = new Set<string>();
  const unique = hymns.filter((hymn) => {
    if (seen.has(hymn.id)) return false;
    seen.add(hymn.id);
    return true;
  });
  unique.sort((left, right) => left.title.localeCompare(right.title));

  const out = join(import.meta.dirname, "..", "src", "hymns.json");
  writeFileSync(out, `${JSON.stringify(unique, null, 2)}\n`);
  console.log(`${unique.length} hymns written, ${skipped.length} left out of ${files.length}.`);
}

if (process.argv[1]?.endsWith("import-open-hymnal.ts") === true) main();
