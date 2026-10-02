/**
 * STG-145, ST2.16. The slides a church types, and the editor over them.
 *
 * Main owns this the way it owns the session: the editor window receives an
 * `EditorState` and sends intents, and the only thing it holds for itself is
 * the text somebody is partway through typing.
 *
 * Free of Electron on purpose, so the save path, the validation report and the
 * parse can be tested without opening a window. The one thing it reaches is the
 * library on disk, behind a four method interface, because what this class
 * needs from storage is small and naming it keeps a test honest.
 */

import {
  newPresentation,
  presentationsFrom,
  slideInputs,
  slidesFrom,
  validatePresentation,
  type Presentation,
  type PresentationLookup,
  type WholeSong,
} from "@hearth/songs";
import type { LibraryItem as StoredItem } from "@hearth/stage-store";
import type {
  EditorState,
  Intent,
  LibraryItem,
  SlideDraft,
  ThemeChoice,
} from "@hearth/stage-protocol";
import { BUILT_IN_THEMES, hasTheme } from "./themes";

/** What this needs from the library. `Library` from the store satisfies it. */
export interface PresentationLibrary {
  savePresentation(presentation: Presentation): void;
  getPresentation(presentationId: string): Presentation | null;
  allPresentations(): Presentation[];
  /** Songs and presentations as one list (STG-146). */
  items(): StoredItem[];
  get(songId: string): WholeSong | null;
}

export interface PresentationsOptions {
  /** Overridden in a test, so saved ids are predictable. */
  id?: () => string;
}

/**
 * Ids for presentations typed on this laptop.
 *
 * Time ordered and random at the end, so two laptops that later pair cannot
 * collide and the library sorts roughly by age without a second column.
 */
function randomId(): string {
  const stamp = Date.now().toString(36);
  const noise = Math.random().toString(36).slice(2, 10);
  return `pres_${stamp}${noise}`;
}

export class Presentations {
  private readonly library: PresentationLibrary;
  private readonly nextId: () => string;
  private editingId: string | null = null;
  /** True after "New", before the first save, when there is no row yet. */
  private drafting = false;
  /**
   * Bumped when a different presentation is opened. A save leaves it alone.
   *
   * The window replaces its boxes when this changes, so storing what somebody
   * typed cannot reach in and rewrite what they are still typing.
   */
  private serial = 0;
  private problems: { code: string; detail: string }[] = [];
  private revision = 0;

  constructor(library: PresentationLibrary, options: PresentationsOptions = {}) {
    this.library = library;
    this.nextId = options.id ?? randomId;
  }

  /** The lookup the deck compiler takes. Read fresh, so a save shows up. */
  lookup(): PresentationLookup {
    return presentationsFrom(this.library.allPresentations());
  }

  apply(intent: Intent): boolean {
    switch (intent.type) {
      case "newPresentation":
        this.editingId = null;
        this.drafting = true;
        this.problems = [];
        this.serial += 1;
        this.revision += 1;
        return true;

      case "openItem": {
        // One list, so the window asks for a row rather than for a kind. Which
        // table it came from is this side's business.
        const found =
          this.library.getPresentation(intent.itemId) !== null ||
          this.library.get(intent.itemId) !== null;
        if (!found) return false;
        this.editingId = intent.itemId;
        this.drafting = false;
        this.problems = [];
        this.serial += 1;
        this.revision += 1;
        return true;
      }

      case "savePresentation":
        return this.save(intent.presentationId, intent.title, intent.slides, intent.themeId);

      default:
        return false;
    }
  }

  /**
   * Saves what is on screen.
   *
   * The renderer sends a title and one box per slide, and the splitting,
   * numbering and dropping of empty boxes happens here, because a renderer that
   * built slides itself could build them a second way. Problems come back on
   * the state rather than as an exception, so a person who left the title empty
   * sees the reason beside the field instead of losing what they typed.
   */
  private save(
    presentationId: string | null,
    title: string,
    slides: SlideDraft[],
    themeId?: string | null,
  ): boolean {
    // Null means create. The window sends the open presentation's id when there
    // is one, so "save" and "save a copy" cannot be confused here.
    const id = presentationId ?? this.nextId();

    // A song opens in this window read only, so a save naming one is a window
    // with a defect in it. Refused here rather than written, because writing it
    // would put a presentation and a song in the library under one id.
    if (this.library.get(id) !== null) return false;

    const existing = this.library.getPresentation(id);

    // A theme this build does not have is refused rather than stored, so a
    // window with a stale list cannot write an id nothing can resolve.
    const look =
      themeId === undefined
        ? (existing?.themeId ?? null)
        : themeId === null || hasTheme(themeId)
          ? themeId
          : (existing?.themeId ?? null);

    const presentation: Presentation = {
      ...(existing ?? newPresentation(id)),
      id,
      title: title.trim(),
      slides: slidesFrom(id, slides),
      themeId: look,
    };

    const found = validatePresentation(presentation);
    if (found.some((problem) => problem.severity === "error")) {
      this.problems = found.map((problem) => ({
        code: problem.code,
        detail: detailOf(problem),
      }));
      // The id is kept so a second attempt after fixing the title saves to the
      // same row rather than leaving an orphan.
      this.editingId = existing === null ? null : id;
      this.revision += 1;
      return true;
    }

    this.library.savePresentation(presentation);
    this.editingId = id;
    this.drafting = false;
    this.problems = [];
    this.revision += 1;
    return true;
  }

  /** What the editor window paints. */
  state(presentingId: string | null = null): EditorState {
    return {
      revision: this.revision,
      themes: BUILT_IN_THEMES.map(
        (entry): ThemeChoice => ({
          id: entry.theme.id,
          name: entry.name,
          background: entry.theme.background,
          colour: entry.theme.colour,
          fontFamily: entry.theme.fontFamily,
        }),
      ),
      library: this.library.items().map(
        (row): LibraryItem => ({
          id: row.id,
          kind: row.kind,
          title: row.title,
          subtitle: row.subtitle,
          count: row.count,
          origin: row.origin,
        }),
      ),
      editing: this.open(),
      problems: this.problems,
      presentingId,
    };
  }

  /**
   * What is in the boxes.
   *
   * A song opens here too, as the sections it is made of, and it opens read
   * only. Typing a song in is STG-7, and until it exists this is still better
   * than a row in the list that cannot be opened at all.
   */
  private open(): EditorState["editing"] {
    if (this.editingId !== null) {
      const presentation = this.library.getPresentation(this.editingId);
      if (presentation !== null) {
        return {
          id: presentation.id,
          kind: presentation.kind,
          serial: this.serial,
          title: presentation.title,
          slides: slideInputs(presentation),
          themeId: presentation.themeId,
          // A synced presentation belongs to the platform, so the laptop shows
          // it and does not write it.
          readOnly: presentation.origin !== "local",
        };
      }

      const song = this.library.get(this.editingId);
      if (song !== null) {
        return {
          id: song.song.id,
          kind: "song",
          serial: this.serial,
          title: song.song.title,
          slides: [...song.sections]
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((section) => ({ label: section.label, body: section.lines.join("\n") })),
          themeId: null,
          readOnly: true,
        };
      }
    }

    if (this.drafting || this.problems.length > 0) {
      return {
        id: this.editingId,
        kind: "plain",
        serial: this.serial,
        title: "",
        slides: [],
        themeId: null,
        readOnly: false,
      };
    }

    return null;
  }

  editing(): string | null {
    return this.editingId;
  }
}

/** Enough of a problem to put beside the field, without a sentence. */
function detailOf(problem: { code: string } & Record<string, unknown>): string {
  if (typeof problem["sortOrder"] === "number") return `slide ${problem["sortOrder"] + 1}`;
  if (typeof problem["value"] === "string") return problem["value"];
  return "";
}
