/**
 * @hearth/songs
 *
 * The song model, shared by the web platform and Hearth Stage. See the package
 * README for what belongs here and what deliberately does not.
 *
 * This package has no runtime dependencies, and it never will. It is called
 * from a Next.js server action, from an Electron main process, from a worker
 * thread reading a ProPresenter file, and from a test, so anything it imports
 * all four have to carry.
 */

export {
  SECTION_TYPES,
  MEDIA_KINDS,
  SONG_ORIGINS,
  USAGE_SOURCES,
  type SectionType,
  type MediaKind,
  type SongOrigin,
  type UsageSource,
  type Song,
  type SongSection,
  type Arrangement,
  type ArrangementMedia,
  type WholeSong,
  type SongUsage,
} from "./types";

export {
  TONICS,
  type Tonic,
  type Key,
  isTonic,
  isKey,
  tonicOf,
  isMinor,
  semitonesFromC,
  parseKey,
  isTimeSignature,
} from "./keys";

export {
  MARKER_KINDS,
  type MarkerKind,
  type ItemNote,
  type Verse,
  type SongItem,
  type ScriptureItem,
  type MarkerItem,
  type ServiceItem,
  type ServicePlan,
  orderedItems,
  plannedSeconds,
  notesFor,
} from "./service";

export {
  resolveSequence,
  pickArrangement,
  formatSequence,
  parseSequence,
  type ResolvedSection,
  type ResolvedSequence,
  type SequenceProblem,
} from "./sequence";

export {
  splitSection,
  splitBilingual,
  DEFAULT_LIMITS,
  type Slide,
  type SlideLimits,
  type BilingualSlide,
} from "./slides";

export {
  compileDeck,
  lookupFrom,
  nextCue,
  cueAt,
  positionOf,
  groupOf,
  deckIsComplete,
  type Deck,
  type Cue,
  type CueGroup,
  type CueKind,
  type DeckProblem,
  type SongLookup,
  type CompileOptions,
} from "./deck";

export {
  parseChord,
  formatChord,
  transposeChord,
  transposeSymbol,
  semitonesBetween,
  parseChordPro,
  transposeChordPro,
  chordsIn,
  chordsOverLyrics,
  keyOf,
  type Chord,
  type ChordProLine,
  type ChordProPart,
} from "./chords";

export {
  validateWholeSong,
  hasErrors,
  errorsOnly,
  type Severity,
  type SongProblem,
  type SongProblemCode,
} from "./validate";
