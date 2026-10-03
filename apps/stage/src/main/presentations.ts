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
  BUNDLED_HYMN_COUNT,
  bundledHymns,
  duplicateSetList,
  newSetList,
  orderedEntries,
  newPresentation,
  presentationsFrom,
  slideInputs,
  slidesFrom,
  validatePresentation,
  type ItemKind,
  type Presentation,
  type PresentationLookup,
  type SetEntry,
  type SetList,
  type WholeSong,
} from "@hearth/songs";
import type { LibraryItem as StoredItem, SetListSummary } from "@hearth/stage-store";
import { hasErrors, setListHasErrors, validateSetList, validateWholeSong } from "@hearth/songs";
import type {
  EditorState,
  Intent,
  LibraryItem,
  OrderDraft,
  SetEntryDraft,
  SetListRow,
  SlideDraft,
  SongFields,
  ThemeChoice,
} from "@hearth/stage-protocol";
import { BUILT_IN_THEMES, hasTheme } from "./themes";
import { fieldsOf, orderDrafts, sectionDrafts, songFrom } from "./songs";
import { t } from "@hearth/stage-i18n";

/** What this needs from the library. `Library` from the store satisfies it. */
export interface PresentationLibrary {
  savePresentation(presentation: Presentation): void;
  getPresentation(presentationId: string): Presentation | null;
  allPresentations(): Presentation[];
  /** Songs and presentations as one list (STG-146). */
  items(): StoredItem[];
  get(songId: string): WholeSong | null;
  save(whole: WholeSong): void;
  /** Running orders (STG-46). */
  saveSetList(list: SetList): void;
  getSetList(setListId: string): SetList | null;
  setLists(): SetListSummary[];
  kindOf(itemId: string): ItemKind | undefined;
}

export interface PresentationsOptions {
  /** Overridden in a test, so saved ids are predictable. */
  id?: (prefix: string) => string;
}

/**
 * Ids for presentations typed on this laptop.
 *
 * Time ordered and random at the end, so two laptops that later pair cannot
 * collide and the library sorts roughly by age without a second column.
 */
function randomId(prefix: string): string {
  const stamp = Date.now().toString(36);
  const noise = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${stamp}${noise}`;
}

export class Presentations {
  private readonly library: PresentationLibrary;
  private readonly makeId: (prefix: string) => string;
  private editingId: string | null = null;
  /** True after "New", before the first save, when there is no row yet. */
  private drafting = false;
  /**
   * Where the thing being drafted is going (STG-169).
   *
   * A slide typed inside a presentation plan belongs to that plan, so it is written
   * off the shelf and its id is appended to the plan on the first save. A slide
   * typed in the library goes on the shelf, which is what the library is.
   */
  private draftShelf = true;
  private draftIntoSet: string | null = null;
  /**
   * Bumped when a different presentation is opened. A save leaves it alone.
   *
   * The window replaces its boxes when this changes, so storing what somebody
   * typed cannot reach in and rewrite what they are still typing.
   */
  private serial = 0;
  private problems: { code: string; detail: string }[] = [];
  private revision = 0;
  /** This machine (STG-14). Set on the way up, and again on a rename. */
  private machine: EditorState["device"] = { name: "Stage", platform: process.platform };
  /** Whether the church has given Stage a logo (STG-22). */
  private logo = false;
  /** The running order open in the window, where one is (STG-46). */
  private setEditingId: string | null = null;
  private setDrafting = false;
  private setSerial = 0;
  /** Which page the window shows, and which kind the library is on (STG-46). */
  private page: "none" | "plans" | "library" | "settings" = "none";
  private libraryKind: "song" | "media" | "slides" | null = null;

  constructor(library: PresentationLibrary, options: PresentationsOptions = {}) {
    this.library = library;
    this.makeId = options.id ?? randomId;
  }

  /** What the window shows as the name of this laptop. */
  device(machine: EditorState["device"]): void {
    this.machine = machine;
    this.revision += 1;
  }

  /** Whether there is a logo to show on the key that clears the room. */
  branding(hasLogo: boolean): void {
    this.logo = hasLogo;
    this.revision += 1;
  }

  private nextId(prefix: string): string {
    return this.makeId(prefix);
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
        this.draftShelf = true;
        this.draftIntoSet = null;
        this.problems = [];
        this.serial += 1;
        this.revision += 1;
        return true;

      /**
       * A slide typed inside the open presentation plan (STG-169, ST2.8).
       *
       * Nothing is written yet. The row appears on the first save, off the
       * shelf, and its id is appended to the plan at the same moment, so a
       * plan never names a slide that does not exist.
       */
      case "newPlanSlide": {
        if (this.setEditingId === null) return false;
        this.editingId = null;
        this.drafting = true;
        this.draftShelf = false;
        this.draftIntoSet = this.setEditingId;
        this.problems = [];
        this.serial += 1;
        this.revision += 1;
        return true;
      }

      /** Onto the shelf, as a deliberate act (STG-169). */
      case "saveToLibrary": {
        if (this.editingId === null) return false;
        const open = this.library.getPresentation(this.editingId);
        if (open === null || open.inLibrary) return false;
        this.library.savePresentation({ ...open, inLibrary: true });
        this.revision += 1;
        return true;
      }

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
        return this.save(
          intent.presentationId,
          intent.title,
          intent.slides,
          intent.themeId,
          intent.reference,
        );

      case "saveSong":
        return this.saveSong(
          intent.songId,
          intent.title,
          intent.fields,
          intent.sections,
          intent.orders,
        );

      case "addSamples": {
        // Written one at a time, skipping any the church already has, so
        // pressing it twice cannot put a hymn in twice or undo an edit.
        let added = 0;
        for (const hymn of bundledHymns()) {
          if (this.library.get(hymn.song.id) !== null) continue;
          this.library.save(hymn);
          added += 1;
        }
        if (added === 0) return false;
        this.revision += 1;
        return true;
      }

      // Out of the workbench, back to the service this window is running.
      case "showControl":
        this.closeOpen();
        this.closeSet();
        this.page = "none";
        this.revision += 1;
        return true;

      case "showPlans":
        this.closeOpen();
        this.page = "plans";
        this.revision += 1;
        return true;

      case "showLibrary":
        this.closeOpen();
        this.page = "library";
        // Back to the choice. A library shown whole is a list nobody can read.
        this.libraryKind = null;
        this.revision += 1;
        return true;

      case "showSettings":
        this.closeOpen();
        this.page = "settings";
        this.revision += 1;
        return true;

      case "showLibraryKind":
        this.page = "library";
        this.libraryKind = intent.kind;
        this.revision += 1;
        return true;

      case "newSetList":
        // A running order and an item are never open at once. The window shows
        // one thing, and a church building Sunday is not also typing a hymn.
        this.closeOpen();
        this.page = "plans";
        this.setEditingId = null;
        this.setDrafting = true;
        this.setSerial += 1;
        this.revision += 1;
        return true;

      case "openSetList": {
        if (this.library.getSetList(intent.setListId) === null) return false;
        this.closeOpen();
        this.page = "plans";
        this.setEditingId = intent.setListId;
        this.setDrafting = false;
        this.setSerial += 1;
        this.revision += 1;
        return true;
      }

      case "duplicateSetList": {
        const last = this.library.getSetList(intent.setListId);
        if (last === null) return false;
        const copy = duplicateSetList(last, this.nextId("set"));
        this.library.saveSetList(copy);
        // Opened, because somebody who pressed it is about to change two things
        // in it and then present it.
        this.closeOpen();
        this.page = "plans";
        this.setEditingId = copy.id;
        this.setDrafting = false;
        this.setSerial += 1;
        this.revision += 1;
        return true;
      }

      case "closeSetList":
        if (this.setEditingId === null && !this.setDrafting) return false;
        this.setEditingId = null;
        this.setDrafting = false;
        this.setSerial += 1;
        this.revision += 1;
        return true;

      case "saveSetList":
        return this.saveSet(intent.setListId, intent.title, intent.date, intent.entries);

      case "closeItem":
        if (this.editingId === null && !this.drafting && this.problems.length === 0) return false;
        this.editingId = null;
        this.drafting = false;
        this.problems = [];
        this.serial += 1;
        this.revision += 1;
        return true;

      default:
        return false;
    }
  }

  /** Closes the running order open in the window, where one is. */
  private closeSet(): void {
    this.setEditingId = null;
    this.setDrafting = false;
    this.setSerial += 1;
  }

  /** Closes whatever item is open, so one thing is open at a time. */
  private closeOpen(): void {
    this.editingId = null;
    this.drafting = false;
    this.draftShelf = true;
    this.draftIntoSet = null;
    this.problems = [];
    this.serial += 1;
  }

  /**
   * Writes a running order (STG-46, ST2.8).
   *
   * The same shape as saving anything else here: the window sends what it has,
   * the model validates, and a problem comes back on the state rather than as
   * an exception, because a person who left the name empty should see the
   * reason beside the field rather than lose the order they just built.
   */
  private saveSet(
    setListId: string | null,
    title: string,
    date: string,
    entries: SetEntryDraft[],
  ): boolean {
    const id = setListId ?? this.nextId("set");
    const existing = this.library.getSetList(id);

    const list: SetList = {
      ...(existing ?? newSetList(id)),
      id,
      title: title.trim(),
      date,
      entries: entries.map(
        (entry, index): SetEntry => ({
          id: `${id}:entry:${index}`,
          setListId: id,
          sortOrder: index,
          kind: entry.kind,
          itemId: entry.kind === "marker" ? null : entry.itemId,
          title: entry.title.trim(),
          notes: entry.notes ?? null,
        }),
      ),
    };

    const found = validateSetList(list);
    if (setListHasErrors(found)) {
      this.problems = found
        .filter((problem) => problem.severity === "error")
        .map((problem) => ({ code: problem.code, detail: detailOf({ ...problem }) }));
      this.setEditingId = existing === null ? null : id;
      this.revision += 1;
      return true;
    }

    this.library.saveSetList(list);
    this.setEditingId = id;
    this.setDrafting = false;
    this.problems = [];
    this.revision += 1;
    return true;
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
    reference?: string | null,
  ): boolean {
    // Null means create. The window sends the open presentation's id when there
    // is one, so "save" and "save a copy" cannot be confused here.
    const id = presentationId ?? this.nextId("pres");

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
      ...(existing ?? newPresentation(id, { inLibrary: this.draftShelf })),
      id,
      title: title.trim(),
      slides: slidesFrom(id, slides),
      themeId: look,
      reference:
        reference === undefined
          ? (existing?.reference ?? null)
          : reference === null || reference.trim() === ""
            ? null
            : reference.trim(),
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
    if (existing === null && this.draftIntoSet !== null) this.intoSet(this.draftIntoSet, presentation);
    this.draftIntoSet = null;
    this.editingId = id;
    this.drafting = false;
    this.problems = [];
    this.revision += 1;
    return true;
  }

  /**
   * Appends a freshly written slide to the plan it was typed inside.
   *
   * The serial moves, because the plan is open behind this and the window is
   * holding a copy of it from before the slide existed. Without the bump the
   * window keeps the older copy and writes it back over this one.
   */
  private intoSet(setListId: string, presentation: Presentation): void {
    const list = this.library.getSetList(setListId);
    if (list === null) return;
    this.setSerial += 1;
    this.library.saveSetList({
      ...list,
      entries: [
        ...orderedEntries(list),
        {
          id: `${list.id}:entry:${list.entries.length}`,
          setListId: list.id,
          sortOrder: list.entries.length,
          kind: "item",
          itemId: presentation.id,
          title: presentation.title,
          notes: null,
        },
      ],
    });
  }

  /**
   * Writes a song somebody typed (STG-7, ST2.1).
   *
   * The same shape as saving a presentation: the window sends boxes, the model
   * turns them into records, and the store validates. Problems come back on the
   * state, because a person who left the title empty should see the reason
   * beside the field rather than lose what they typed.
   */
  private saveSong(
    songId: string | null,
    title: string,
    fields: SongFields,
    sections: SlideDraft[],
    orders?: OrderDraft[],
  ): boolean {
    const id = songId ?? this.nextId("song");

    // A presentation under this id would mean two rows in the library sharing a
    // key, so a save naming one is a window with a defect in it.
    if (this.library.getPresentation(id) !== null) return false;

    const existing = this.library.get(id);
    if (existing !== null && existing.song.origin !== "local") return false;

    const whole = songFrom({ id, title, fields, sections, orders, existing });
    const found = validateWholeSong(whole);
    if (hasErrors(found)) {
      this.problems = found
        .filter((problem) => problem.severity === "error")
        .map((problem) => ({ code: problem.code, detail: detailOf(problem) }));
      this.editingId = existing === null ? null : id;
      this.revision += 1;
      return true;
    }

    this.library.save(whole);
    this.editingId = id;
    this.drafting = false;
    this.problems = [];
    this.revision += 1;
    return true;
  }

  /** What the editor window paints. */
  state(presentingId: string | null = null, service: string | null = null): EditorState {
    return {
      revision: this.revision,
      themes: BUILT_IN_THEMES.map(
        (entry): ThemeChoice => ({
          id: entry.theme.id,
          name: t(entry.name),
          background: entry.theme.background,
          gradient: entry.theme.gradient,
          colour: entry.theme.colour,
          fontFamily: entry.theme.fontFamily,
          textAlign: entry.theme.textAlign,
        }),
      ),
      library: this.library.items().map(
        (row): LibraryItem => ({
          id: row.id,
          kind: row.kind,
          title: row.title,
          subtitle: row.subtitle,
          count: row.count,
          preview: row.preview,
          themeId: row.themeId,
          origin: row.origin,
        }),
      ),
      editing: this.open(),
      page: this.page,
      libraryKind: this.libraryKind,
      setLists: this.library.setLists().map(
        (row): SetListRow => ({
          id: row.id,
          title: row.title,
          date: row.date,
          entries: row.entries,
        }),
      ),
      editingSet: this.openSet(),
      device: this.machine,
      hasLogo: this.logo,
      samples: this.samplesLeft(),
      problems: this.problems,
      presentingId,
      service,
    };
  }

  /** The running order in the window, where one is (STG-46). */
  private openSet(): EditorState["editingSet"] {
    if (this.setEditingId !== null) {
      const list = this.library.getSetList(this.setEditingId);
      if (list !== null) {
        return {
          id: list.id,
          serial: this.setSerial,
          title: list.title,
          date: list.date,
          entries: orderedEntries(list).map((entry) => ({
            kind: entry.kind,
            itemId: entry.itemId,
            title: entry.title,
            notes: entry.notes,
          })),
        };
      }
    }

    if (this.setDrafting) {
      return {
        id: this.setEditingId,
        serial: this.setSerial,
        title: "",
        date: new Date().toISOString().slice(0, 10),
        entries: [],
      };
    }

    return null;
  }

  /** How many of the bundled hymns the library does not have (STG-10). */
  private samplesLeft(): number {
    const held = new Set(this.library.items().map((row) => row.id));
    if (held.size === 0) return BUNDLED_HYMN_COUNT;
    return bundledHymns().filter((hymn) => !held.has(hymn.song.id)).length;
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
          reference: presentation.reference,
          song: null,
          orders: [],
          // A synced presentation belongs to the platform, so the laptop shows
          // it and does not write it.
          readOnly: presentation.origin !== "local",
          inLibrary: presentation.inLibrary,
        };
      }

      const song = this.library.get(this.editingId);
      if (song !== null) {
        return {
          id: song.song.id,
          kind: "song",
          serial: this.serial,
          title: song.song.title,
          slides: sectionDrafts(song),
          themeId: null,
          reference: null,
          song: fieldsOf(song.song),
          orders: orderDrafts(song),
          // A synced song belongs to the platform, so the laptop shows it and
          // does not write it (PRD section 2, the two-writer rule).
          readOnly: song.song.origin !== "local",
          inLibrary: true,
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
        reference: null,
        song: null,
        orders: [],
        readOnly: false,
        inLibrary: this.draftShelf,
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
