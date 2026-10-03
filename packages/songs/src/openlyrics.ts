/**
 * STG-54, ST2.12. The library as OpenLyrics.
 *
 * A church leaving Stage takes its library, and takes it in a format something
 * else can read. OpenLyrics is the one open song format the other presenters
 * agree on: OpenLP, OpenSong and a handful of others read it, so this is the
 * door out that actually opens onto somewhere.
 *
 * Written by hand rather than through an XML library, because the document is
 * small and regular and a dependency here would be a dependency the renderer
 * inherits. `packages/songs` has none on purpose.
 *
 * Specification: https://docs.openlyrics.org, version 0.9.
 */

import { labelsFor } from "./labels";
import type { SectionType, SongSection, WholeSong } from "./types";

/** The names OpenLyrics gives a section, by our section kind. */
const VERSE_PREFIX: Record<SectionType, string> = {
  intro: "i",
  verse: "v",
  pre_chorus: "p",
  chorus: "c",
  bridge: "b",
  tag: "t",
  instrumental: "m",
  ending: "e",
};

/**
 * Text, safe inside an element.
 *
 * `&` first, or the escapes escape each other. Angle brackets because a song
 * about the Lion of Judah can contain one, and a church that typed it should
 * get it back.
 */
function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Our label as an OpenLyrics verse name.
 *
 * `V1` is `v1`, `C` is `c`, and anything we cannot read becomes `o` plus its
 * position, which is OpenLyrics' own name for a section that is none of the
 * named kinds. Lower case throughout, because the format says so.
 */
function nameOf(section: SongSection, label: string, at: number): string {
  const prefix = VERSE_PREFIX[section.sectionType];
  const number = /(\d+)$/.exec(label)?.[1] ?? "";
  if (prefix === undefined) return `o${at + 1}`;
  return `${prefix}${number}`;
}

function element(tag: string, text: string | null): string {
  if (text === null || text.trim() === "") return "";
  return `    <${tag}>${escape(text)}</${tag}>\n`;
}

/**
 * One song as an OpenLyrics document.
 *
 * `modifiedDate` is the song's own last change where the caller hands one in,
 * rather than the moment of export, so exporting a library twice produces the
 * same files and a church can see what actually changed.
 */
export function toOpenLyrics(whole: WholeSong, options: { at?: string } = {}): string {
  const { song } = whole;
  const ordered = [...whole.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  // The primary language only. A translation is section-aligned here and
  // OpenLyrics carries it as a separate song, which is a conversion rather
  // than an export, so it is left for the importer story that needs it.
  const primary = ordered.filter((section) => section.translationOf === null);
  const labels = labelsFor(primary);

  const names = new Map<string, string>();
  primary.forEach((section, at) => {
    names.set(section.label, nameOf(section, labels[at] ?? section.label, at));
  });

  const titles = [song.title, ...song.alternateTitles]
    .filter((title) => title.trim() !== "")
    .map((title) => `      <title>${escape(title)}</title>\n`)
    .join("");

  const authors = [song.author, song.composer]
    .filter((who): who is string => who !== null && who.trim() !== "")
    .map((who) => `      <author>${escape(who)}</author>\n`)
    .join("");

  const order = whole.arrangements.find((one) => one.isDefault) ?? whole.arrangements[0];
  const verseOrder =
    order === undefined
      ? ""
      : order.sequence
          .map((label) => names.get(label))
          .filter((name): name is string => name !== undefined)
          .join(" ");

  const lyrics = primary
    .map((section) => {
      const name = names.get(section.label) ?? "o1";
      const lines = section.lines.map(escape).join("<br/>\n        ");
      return (
        `    <verse name="${escape(name)}"${section.language === song.primaryLanguage ? "" : ` lang="${escape(section.language)}"`}>\n` +
        `      <lines>${lines}</lines>\n` +
        `    </verse>\n`
      );
    })
    .join("");

  const modified = options.at ?? song.lastUsedAt ?? "";

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<song xmlns="http://openlyrics.info/namespace/2009/song" version="0.9"' +
    ' createdIn="Hearth Stage"' +
    ' modifiedIn="Hearth Stage"' +
    (modified === "" ? "" : ` modifiedDate="${escape(modified)}"`) +
    ">\n" +
    "  <properties>\n" +
    (titles === "" ? "" : `    <titles>\n${titles}    </titles>\n`) +
    (authors === "" ? "" : `    <authors>\n${authors}    </authors>\n`) +
    element("copyright", song.isPublicDomain ? "Public Domain" : song.copyrightLine) +
    element("ccliNo", song.ccliNumber) +
    element("released", song.year === null ? null : String(song.year)) +
    element("publisher", song.publisher) +
    element("tempo", song.tempoBpm === null ? null : String(song.tempoBpm)) +
    element("key", song.defaultKey) +
    element("verseOrder", verseOrder === "" ? null : verseOrder) +
    (song.themes.length === 0
      ? ""
      : `    <themes>\n${song.themes.map((theme) => `      <theme>${escape(theme)}</theme>\n`).join("")}    </themes>\n`) +
    "  </properties>\n" +
    `  <lyrics>\n${lyrics}  </lyrics>\n` +
    "</song>\n"
  );
}

/**
 * A file name for a song, safe on every filesystem a church uses.
 *
 * Windows refuses a handful of characters that macOS allows, and a church that
 * exports on a Mac and opens the folder on a Windows machine should find every
 * file there. The id is on the end so two songs of one name cannot collide.
 */
export function fileNameFor(whole: WholeSong): string {
  const name = whole.song.title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const safe = name === "" ? "song" : name;
  return `${safe} (${whole.song.id}).xml`;
}
