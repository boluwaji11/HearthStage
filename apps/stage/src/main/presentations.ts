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
} from "@hearth/songs";
import type {
  EditorState,
  Intent,
  PresentationSummary,
  SlideDraft,
} from "@hearth/stage-protocol";

/** What this needs from the library. `Library` from the store satisfies it. */
export interface PresentationLibrary {
  savePresentation(presentation: Presentation): void;
  getPresentation(presentationId: string): Presentation | null;
  listPresentations(): {
    id: string;
    title: string;
    kind: string;
    origin: "local" | "hearth";
    slideCount: number;
    archivedAt: string | null;
    updatedAt: string;
  }[];
  allPresentations(): Presentation[];
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
   * Bumped when a different presentation is opened, and never on a save.
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

      case "editPresentation": {
        if (this.library.getPresentation(intent.presentationId) === null) return false;
        this.editingId = intent.presentationId;
        this.drafting = false;
        this.problems = [];
        this.serial += 1;
        this.revision += 1;
        return true;
      }

      case "savePresentation":
        return this.save(intent.presentationId, intent.title, intent.slides);

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
  private save(presentationId: string | null, title: string, slides: SlideDraft[]): boolean {
    // Null means create. The window sends the open presentation's id when there
    // is one, so "save" and "save a copy" cannot be confused here.
    const id = presentationId ?? this.nextId();
    const existing = this.library.getPresentation(id);

    const presentation: Presentation = {
      ...(existing ?? newPresentation(id)),
      id,
      title: title.trim(),
      slides: slidesFrom(id, slides),
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
    const open = this.editingId === null ? null : this.library.getPresentation(this.editingId);

    return {
      revision: this.revision,
      library: this.library.listPresentations().map(
        (row): PresentationSummary => ({
          id: row.id,
          title: row.title,
          kind: row.kind,
          slideCount: row.slideCount,
          origin: row.origin,
          updatedAt: row.updatedAt,
          archivedAt: row.archivedAt,
        }),
      ),
      editing:
        open !== null
          ? {
              id: open.id,
              serial: this.serial,
              title: open.title,
              slides: slideInputs(open),
              // A synced presentation belongs to the platform, so the laptop
              // shows it and does not write it.
              readOnly: open.origin !== "local",
            }
          : this.drafting || this.problems.length > 0
            ? { id: this.editingId, serial: this.serial, title: "", slides: [], readOnly: false }
            : null,
      problems: this.problems,
      presentingId,
    };
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
