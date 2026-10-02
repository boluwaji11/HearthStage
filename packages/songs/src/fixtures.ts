/**
 * STG-1. Songs the tests can rely on, and the set Stage offers on first run.
 *
 * Every song here is in the public domain, which is a requirement rather than a
 * convenience: Stage ships with no copyrighted lyrics of any kind, because
 * lyrics are the church's CCLI responsibility and bundling any would make them
 * ours (PRD section 4).
 *
 * These are well formed on purpose. The broken cases live in the tests, built
 * from `blankSong` so that what is wrong with each one is visible at the place
 * it is asserted.
 */

import type { ServicePlan } from "./service";
import type { Arrangement, Song, SongSection, WholeSong } from "./types";

/**
 * A song with nothing filled in, for a test or a form to build on.
 *
 * Every nullable field is null and every list is empty, so a test that omits a
 * field is testing the absence of it rather than inheriting a value from a
 * fixture it did not read.
 */
export function blankSong(overrides: Partial<Song> = {}): Song {
  return {
    id: "song-blank",
    origin: "local",
    title: "Untitled",
    alternateTitles: [],
    author: null,
    composer: null,
    publisher: null,
    year: null,
    ccliNumber: null,
    copyrightLine: null,
    isPublicDomain: false,
    themes: [],
    tempoBpm: null,
    timeSignature: null,
    typicalDurationSeconds: null,
    defaultKey: null,
    primaryLanguage: "en",
    lastUsedAt: null,
    ...overrides,
  };
}

export function blankSection(overrides: Partial<SongSection> = {}): SongSection {
  return {
    id: "section-blank",
    songId: "song-blank",
    sectionType: "verse",
    label: "V1",
    sortOrder: 0,
    lines: ["A line"],
    language: "en",
    translationOf: null,
    ...overrides,
  };
}

export function blankArrangement(overrides: Partial<Arrangement> = {}): Arrangement {
  return {
    id: "arrangement-blank",
    songId: "song-blank",
    name: "Default",
    key: "C",
    tempoBpm: null,
    sequence: ["V1"],
    chordpro: null,
    isDefault: true,
    ...overrides,
  };
}

export function blankWholeSong(overrides: Partial<WholeSong> = {}): WholeSong {
  return {
    song: blankSong(),
    sections: [blankSection()],
    arrangements: [blankArrangement()],
    media: [],
    ...overrides,
  };
}

/**
 * "Amazing Grace", John Newton, 1779. Public domain.
 *
 * Carries a Spanish translation of the first verse, section aligned, so the
 * bilingual join in R12.8 has something real to be tested against.
 */
export const amazingGrace: WholeSong = {
  song: blankSong({
    id: "song-amazing-grace",
    title: "Amazing Grace",
    alternateTitles: ["Amazing Grace! How Sweet the Sound"],
    author: "John Newton",
    year: 1779,
    ccliNumber: "22025",
    copyrightLine: "Public Domain",
    isPublicDomain: true,
    themes: ["grace", "salvation", "assurance"],
    tempoBpm: 72,
    timeSignature: "3/4",
    typicalDurationSeconds: 240,
    defaultKey: "G",
    primaryLanguage: "en",
  }),
  sections: [
    {
      id: "ag-v1",
      songId: "song-amazing-grace",
      sectionType: "verse",
      label: "V1",
      sortOrder: 0,
      lines: [
        "Amazing grace! how sweet the sound",
        "That saved a wretch like me!",
        "I once was lost, but now am found,",
        "Was blind, but now I see.",
      ],
      language: "en",
      translationOf: null,
    },
    {
      id: "ag-v2",
      songId: "song-amazing-grace",
      sectionType: "verse",
      label: "V2",
      sortOrder: 1,
      lines: [
        "'Twas grace that taught my heart to fear,",
        "And grace my fears relieved;",
        "How precious did that grace appear",
        "The hour I first believed!",
      ],
      language: "en",
      translationOf: null,
    },
    {
      id: "ag-v3",
      songId: "song-amazing-grace",
      sectionType: "verse",
      label: "V3",
      sortOrder: 2,
      lines: [
        "Through many dangers, toils and snares,",
        "I have already come;",
        "'Tis grace hath brought me safe thus far,",
        "And grace will lead me home.",
      ],
      language: "en",
      translationOf: null,
    },
    {
      id: "ag-v1-es",
      songId: "song-amazing-grace",
      sectionType: "verse",
      label: "V1-es",
      sortOrder: 3,
      lines: [
        "Sublime gracia del Señor,",
        "que a un pecador salvó;",
        "fui ciego y hoy veo yo,",
        "perdido y Él me halló.",
      ],
      language: "es",
      translationOf: "ag-v1",
    },
  ],
  arrangements: [
    {
      id: "ag-sunday",
      songId: "song-amazing-grace",
      name: "Sunday",
      key: "G",
      tempoBpm: 72,
      sequence: ["V1", "V2", "V3"],
      chordpro: [
        "{title: Amazing Grace}",
        "{key: G}",
        "{comment: NEW BRITAIN. Public domain.}",
        "",
        "{start_of_verse: V1}",
        "A[G]mazing grace! how [G7]sweet the [C]sound",
        "That [G]saved a wretch like [D/F#]me!",
        "I [G]once was lost, but [G7]now am [C]found,",
        "Was [G]blind, but [D]now I [G]see.",
        "{end_of_verse}",
      ].join("\n"),
      isDefault: true,
    },
    {
      id: "ag-short",
      songId: "song-amazing-grace",
      name: "Two verses",
      key: "D",
      tempoBpm: 76,
      sequence: ["V1", "V3"],
      chordpro: null,
      isDefault: false,
    },
  ],
  media: [],
};

/**
 * "Holy, Holy, Holy", Reginald Heber, 1826. Public domain.
 *
 * The sequence repeats its final verse, which is the case a deck compiler has
 * to produce as two cues rather than one (R12.5).
 */
export const holyHolyHoly: WholeSong = {
  song: blankSong({
    id: "song-holy",
    title: "Holy, Holy, Holy",
    alternateTitles: ["Holy, Holy, Holy! Lord God Almighty"],
    author: "Reginald Heber",
    composer: "John B. Dykes",
    year: 1826,
    ccliNumber: "1156",
    copyrightLine: "Public Domain",
    isPublicDomain: true,
    themes: ["worship", "trinity", "holiness"],
    tempoBpm: 60,
    timeSignature: "4/4",
    typicalDurationSeconds: 210,
    defaultKey: "D",
    primaryLanguage: "en",
  }),
  sections: [
    {
      id: "hhh-v1",
      songId: "song-holy",
      sectionType: "verse",
      label: "V1",
      sortOrder: 0,
      lines: [
        "Holy, holy, holy! Lord God Almighty!",
        "Early in the morning our song shall rise to Thee;",
        "Holy, holy, holy! merciful and mighty!",
        "God in three Persons, blessed Trinity!",
      ],
      language: "en",
      translationOf: null,
    },
    {
      id: "hhh-v2",
      songId: "song-holy",
      sectionType: "verse",
      label: "V2",
      sortOrder: 1,
      lines: [
        "Holy, holy, holy! all the saints adore Thee,",
        "Casting down their golden crowns around the glassy sea;",
        "Cherubim and seraphim falling down before Thee,",
        "Which wert, and art, and evermore shalt be.",
      ],
      language: "en",
      translationOf: null,
    },
  ],
  arrangements: [
    {
      id: "hhh-sunday",
      songId: "song-holy",
      name: "Sunday",
      key: "D",
      tempoBpm: 60,
      // The repeat is the point. Two cues, one section.
      sequence: ["V1", "V2", "V1"],
      chordpro: [
        "{title: Holy, Holy, Holy}",
        "{key: D}",
        "{comment: NICAEA. Public domain.}",
        "",
        "{start_of_verse: V1}",
        "[D]Holy, holy, [A]holy! [D]Lord God Al[G]mighty!",
        "[D]Early in the [A]morning our [Bm]song shall [A]rise to [D]Thee;",
        "[D]Holy, holy, [A]holy! [Bm]merciful and [F#m]mighty!",
        "[G]God in three [D/F#]Persons, [A]blessed [D]Trinity!",
        "{end_of_verse}",
      ].join("\n"),
      isDefault: true,
    },
  ],
  media: [],
};

/** The songs Stage offers on first run, so a church starting cold has something. */
export const sampleLibrary: WholeSong[] = [amazingGrace, holyHolyHoly];

/**
 * A Sunday service, for the deck compiler's tests and for `show-deck`.
 *
 * Shaped like a real one rather than like a test: a welcome, two songs with the
 * second in a different key from its arrangement, a reading, the sermon, and a
 * closing reprise of the first song. The notices carry a note addressed to one
 * position, so `notesFor` has something to filter.
 */
export const sundayService: ServicePlan = {
  id: "plan-sunday",
  source: "set_list",
  title: "Sunday Morning",
  date: "2026-10-04",
  startsAt: "2026-10-04T10:30:00-05:00",
  items: [
    {
      type: "marker",
      id: "item-welcome",
      sortOrder: 0,
      title: "Welcome",
      durationSeconds: 120,
      notes: [],
      kind: "welcome",
    },
    {
      type: "song",
      id: "item-holy",
      sortOrder: 1,
      title: "Holy, Holy, Holy",
      durationSeconds: 300,
      notes: [{ position: null, body: "Start a cappella" }],
      songId: "song-holy",
      arrangementId: "hhh-sunday",
      keyOverride: null,
    },
    {
      type: "song",
      id: "item-grace",
      sortOrder: 2,
      title: "Amazing Grace",
      durationSeconds: 330,
      notes: [
        { position: null, body: "Hold the last line" },
        { position: "Drums", body: "In on the second verse" },
      ],
      songId: "song-amazing-grace",
      arrangementId: "ag-sunday",
      // The arrangement is in G and the leader wants it lower this Sunday, so
      // the deck reports Bb and the chart transposes (ST5.6).
      keyOverride: "Bb",
    },
    {
      type: "scripture",
      id: "item-reading",
      sortOrder: 3,
      title: "Psalm 23",
      durationSeconds: 180,
      notes: [],
      reference: "Psalm 23:1-6",
      translation: "KJV",
      verses: [
        { number: 1, text: "The LORD is my shepherd; I shall not want." },
        { number: 2, text: "He maketh me to lie down in green pastures: he leadeth me beside the still waters." },
        { number: 3, text: "He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake." },
        { number: 4, text: "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me." },
        { number: 5, text: "Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over." },
        { number: 6, text: "Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever." },
      ],
    },
    {
      type: "marker",
      id: "item-sermon",
      sortOrder: 4,
      title: "The Good Shepherd",
      durationSeconds: 1800,
      notes: [],
      kind: "sermon",
    },
    {
      type: "song",
      id: "item-grace-reprise",
      sortOrder: 5,
      title: "Amazing Grace (reprise)",
      durationSeconds: 180,
      notes: [],
      songId: "song-amazing-grace",
      // The two-verse arrangement, in its own key.
      arrangementId: "ag-short",
      keyOverride: null,
    },
  ],
};
