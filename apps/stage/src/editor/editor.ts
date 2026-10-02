/**
 * STG-145, ST2.16. Where a person builds a presentation.
 *
 * The person here is Daniel on a Tuesday evening with the sermon outline in
 * another window. He names the thing, presses a button, and gets a slide. Then
 * another. Each slide is its own box, so what is on this screen is the shape of
 * what the room will see.
 *
 * Two decisions carry the window.
 *
 * **It stores itself.** There is no save button. A change commits when the box
 * loses focus, when a slide is added, removed or moved, and a second after
 * typing stops. A volunteer who loses twenty minutes of notices to a button
 * they did not press does not come back to the software.
 *
 * **The draft is local, the library is main's.** State comes down whole, and
 * the window replaces its boxes only when the serial changes, which happens
 * when a different presentation is opened. A save comes back with the serial
 * unchanged, so storing what somebody typed never rewrites what they are still
 * typing.
 */

import { parseSlides } from "@hearth/songs";
import type { EditorState, Intent, LibraryKind, SlideDraft } from "@hearth/stage-protocol";
import { icon } from "./icons";

const bridge = window.hearth;

const el = {
  library: document.getElementById("library") as HTMLOListElement,
  libraryEmpty: document.getElementById("library-empty") as HTMLParagraphElement,
  search: document.getElementById("search") as HTMLInputElement,
  title: document.getElementById("title") as HTMLInputElement,
  slides: document.getElementById("slides") as HTMLOListElement,
  add: document.getElementById("add") as HTMLButtonElement,
  problems: document.getElementById("problems") as HTMLUListElement,
  status: document.getElementById("status") as HTMLParagraphElement,
  undone: document.getElementById("undone") as HTMLParagraphElement,
  undoneWhat: document.getElementById("undone-what") as HTMLSpanElement,
  undo: document.getElementById("undo") as HTMLButtonElement,
  newButton: document.getElementById("new") as HTMLButtonElement,
  present: document.getElementById("present") as HTMLButtonElement,
};

interface Draft {
  id: string | null;
  serial: number;
  kind: LibraryKind;
  title: string;
  slides: SlideDraft[];
  readOnly: boolean;
}

let draft: Draft | null = null;
/** The slides as they were before the last removal, for one step of undo. */
let removed: { slides: SlideDraft[]; what: string } | null = null;
let timer: number | undefined;
let saving = false;
let latest: EditorState | null = null;
/** The slide being dragged, and where it would land. */
let dragging: number | null = null;
let dropAt: number | null = null;

function send(intent: Intent): void {
  bridge?.send(intent);
}

/** How many lines a slide takes, which is how tall its box is. */
const MOST_ROWS = 14;

function rowsFor(body: string): number {
  return Math.min(MOST_ROWS, Math.max(2, body.split("\n").length));
}

// Storing

/**
 * Sends the draft, after a pause.
 *
 * Debounced so a typing session is one write rather than one per keystroke.
 * Every write is durable and backs the library up, which is right for a church
 * that never pairs and wrong to do sixty times a minute.
 */
function schedule(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(commit, 1000);
}

function commit(): void {
  window.clearTimeout(timer);
  if (draft === null || draft.readOnly) return;
  if (draft.title.trim() === "") {
    paintStatus();
    return;
  }
  saving = true;
  paintStatus();
  send({
    type: "savePresentation",
    presentationId: draft.id,
    title: draft.title,
    slides: draft.slides,
  });
}

// The draft

function addSlide(after?: number): void {
  if (draft === null || draft.readOnly) return;
  const at = after === undefined ? draft.slides.length : after + 1;
  draft.slides.splice(at, 0, { label: null, body: "" });
  removed = null;
  renderSlides(at);
  schedule();
}

function removeSlide(index: number): void {
  if (draft === null || draft.readOnly) return;
  // Kept whole rather than by index, so undo puts the list back exactly.
  removed = { slides: draft.slides.map((slide) => ({ ...slide })), what: `Slide ${index + 1}` };
  draft.slides.splice(index, 1);
  renderSlides(Math.max(0, index - 1));
  schedule();
}

function moveSlide(index: number, to: number): void {
  if (draft === null || draft.readOnly) return;
  if (to < 0 || to >= draft.slides.length || to === index) return;
  const [slide] = draft.slides.splice(index, 1);
  if (slide === undefined) return;
  draft.slides.splice(to, 0, slide);
  removed = null;
  renderSlides(to);
  schedule();
}

/**
 * Where a slide lands when it is dropped.
 *
 * `before` is a gap rather than a slide, so dropping below the last card gives
 * a gap one past the end. Taking the slide out first shifts every gap after it
 * down by one, which is the only arithmetic here.
 */
function dropInto(from: number, before: number): void {
  moveSlide(from, before > from ? before - 1 : before);
}

function undoRemoval(): void {
  if (draft === null || removed === null) return;
  draft.slides = removed.slides;
  removed = null;
  renderSlides();
  schedule();
}

// Painting

function clearDropMarks(): void {
  for (const card of el.slides.querySelectorAll<HTMLElement>("[data-drop]")) {
    delete card.dataset["drop"];
  }
}

function renderSlides(focus?: number): void {
  el.slides.replaceChildren();
  if (draft === null) {
    paintStatus();
    return;
  }

  draft.slides.forEach((slide, index) => {
    const item = document.createElement("li");
    item.className = "card";

    const head = document.createElement("div");
    head.className = "card-head";

    const grip = document.createElement("span");
    grip.className = "card-grip";
    grip.append(icon("grip"));
    grip.title = "Drag to move";
    // The row becomes draggable only while the grip is held, so a pointer in
    // the text below selects words the way it does anywhere else.
    grip.addEventListener("mousedown", () => {
      if (draft?.readOnly !== true) item.draggable = true;
    });
    head.append(grip);

    const number = document.createElement("span");
    number.className = "card-number";
    number.textContent = String(index + 1);
    head.append(number);

    const labelFor = document.createElement("label");
    labelFor.className = "card-label-name";
    labelFor.htmlFor = `label-${index}`;
    // The field says where it shows up, because that is the only thing anybody
    // needs to know about it.
    labelFor.textContent = "For the operator";
    head.append(labelFor);

    const label = document.createElement("input");
    label.className = "card-label";
    label.id = `label-${index}`;
    label.type = "text";
    label.autocomplete = "off";
    label.value = slide.label ?? "";
    label.disabled = draft?.readOnly ?? false;
    label.addEventListener("input", () => {
      const value = label.value.trim();
      slide.label = value === "" ? null : label.value;
      schedule();
    });
    label.addEventListener("blur", commit);
    head.append(label);

    const buttons = document.createElement("span");
    buttons.className = "card-buttons";
    // Drawn rather than named, and every one carries the name anyway, because
    // an icon with nothing behind it is refused (docs/design-system.md
    // section 12). Up and down stay because dragging needs a way round it for
    // anybody who cannot drag (WCAG 2.2, 2.5.7).
    for (const [name, mark, action, usable] of [
      ["Move up", "chevron-up", () => moveSlide(index, index - 1), index > 0],
      [
        "Move down",
        "chevron-down",
        () => moveSlide(index, index + 1),
        index < (draft?.slides.length ?? 0) - 1,
      ],
      ["Remove", "trash", () => removeSlide(index), true],
    ] as [string, Parameters<typeof icon>[0], () => void, boolean][]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "icon";
      button.setAttribute("aria-label", name);
      button.title = name;
      button.append(icon(mark));
      button.disabled = !usable || (draft?.readOnly ?? false);
      button.addEventListener("click", action);
      buttons.append(button);
    }
    head.append(buttons);
    item.append(head);

    item.addEventListener("dragstart", (event) => {
      dragging = index;
      item.classList.add("dragging");
      event.dataTransfer?.setData("text/plain", String(index));
      if (event.dataTransfer !== null) event.dataTransfer.effectAllowed = "move";
    });
    item.addEventListener("dragend", () => {
      item.draggable = false;
      dragging = null;
      dropAt = null;
      clearDropMarks();
    });
    item.addEventListener("dragover", (event) => {
      if (dragging === null) return;
      event.preventDefault();
      if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "move";
      const box = item.getBoundingClientRect();
      const above = event.clientY < box.top + box.height / 2;
      dropAt = above ? index : index + 1;
      clearDropMarks();
      item.dataset["drop"] = above ? "above" : "below";
    });
    item.addEventListener("drop", (event) => {
      event.preventDefault();
      if (dragging !== null && dropAt !== null) dropInto(dragging, dropAt);
      dragging = null;
      dropAt = null;
      clearDropMarks();
    });

    const body = document.createElement("textarea");
    body.className = "card-body";
    body.id = `body-${index}`;
    body.setAttribute("aria-label", `Slide ${index + 1}`);
    body.value = slide.body;
    body.rows = rowsFor(slide.body);
    body.readOnly = draft?.readOnly ?? false;
    body.addEventListener("input", () => {
      slide.body = body.value;
      body.rows = rowsFor(body.value);
      paintStatus();
      schedule();
    });
    body.addEventListener("blur", commit);
    body.addEventListener("keydown", (event) => onSlideKey(event, index, body));
    body.addEventListener("paste", (event) => onPaste(event, index, body));
    item.append(body);

    item.append(note(slide));
    el.slides.append(item);
  });

  if (focus !== undefined) {
    const target = el.slides.querySelector<HTMLTextAreaElement>(`#body-${focus}`);
    target?.focus();
    target?.setSelectionRange(target.value.length, target.value.length);
  }

  paintStatus();
}

/**
 * What the slide will do on the wall, where that differs from the box.
 *
 * Shown only when a slide is long enough to be broken in two, because the
 * number on screen has to be the number the room sees.
 */
function note(slide: SlideDraft): HTMLElement {
  const paragraph = document.createElement("p");
  paragraph.className = "card-note quiet";
  const parts = partsOf(slide.body);
  paragraph.textContent = parts > 1 ? `${parts} slides on screen` : "";
  return paragraph;
}

/** The same rule the deck compiler uses, at the default line limit. */
const LINE_LIMIT = 4;

function partsOf(body: string): number {
  const lines = body.split("\n").filter((line) => line.trim() !== "").length;
  return Math.max(1, Math.ceil(lines / LINE_LIMIT));
}

function onSlideKey(event: KeyboardEvent, index: number, body: HTMLTextAreaElement): void {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    commit();
    addSlide(index);
    return;
  }

  // Backspace in an empty box takes the box away, which is how a person undoes
  // an add without reaching for the mouse. An empty box holds nothing to lose.
  if (
    event.key === "Backspace" &&
    body.value === "" &&
    (draft?.slides.length ?? 0) > 1 &&
    draft?.readOnly !== true
  ) {
    event.preventDefault();
    removeSlide(index);
  }
}

/**
 * A sermon outline dropped in from a document.
 *
 * Only into an empty box, and only when the text has a gap in it. There is
 * nothing in an empty box to be surprised by, and a paste into a box that
 * already has words behaves the way a paste behaves everywhere else.
 */
function onPaste(event: ClipboardEvent, index: number, body: HTMLTextAreaElement): void {
  if (draft === null || draft.readOnly) return;
  if (body.value !== "") return;

  const text = event.clipboardData?.getData("text/plain") ?? "";
  if (!/\n[ \t]*\n/.test(text)) return;

  const parsed = parseSlides(text, { presentationId: "paste" });
  if (parsed.length < 2) return;

  event.preventDefault();
  draft.slides.splice(
    index,
    1,
    ...parsed.map((slide) => ({ label: slide.label, body: slide.lines.join("\n") })),
  );
  removed = null;
  renderSlides(index + parsed.length - 1);
  commit();
}

function paintStatus(): void {
  const slides = draft?.slides.filter((slide) => slide.body.trim() !== "").length ?? 0;
  const onScreen = (draft?.slides ?? [])
    .filter((slide) => slide.body.trim() !== "")
    .reduce((total, slide) => total + partsOf(slide.body), 0);

  const parts: string[] = [];
  if (draft !== null) {
    parts.push(`${slides} slide${slides === 1 ? "" : "s"}`);
    if (onScreen !== slides) parts.push(`${onScreen} on screen`);
  }

  if (draft === null) parts.length = 0;
  else if (draft.kind === "song") parts.push("a song, read only");
  else if (draft.readOnly) parts.push("from Hearth, read only");
  else if (draft.title.trim() === "") parts.push("needs a title");
  else if (saving) parts.push("saving");
  else if (draft.id !== null) parts.push("saved");

  el.status.textContent = parts.join("  ·  ");

  el.add.disabled = draft === null || draft.readOnly;
  el.present.disabled = draft === null || draft.id === null || slides === 0;
  el.title.readOnly = draft?.readOnly ?? false;

  el.undone.hidden = removed === null;
  el.undoneWhat.textContent = removed === null ? "" : `${removed.what} removed`;
}

/** What each kind is called in the list (STG-146). */
const KINDS: Record<LibraryKind, string> = {
  song: "Song",
  plain: "Slides",
  reading: "Reading",
  media: "Media",
};

/** What the count means, which depends on what the row holds. */
function countOf(kind: LibraryKind, count: number): string {
  const noun = kind === "song" ? "section" : "slide";
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * The library as one list (STG-146).
 *
 * Songs and typed slides together, each row saying which it is, because the
 * person looking for the notices does not know or care which table they are in.
 * Filtered here rather than in main: a search box that waits for a round trip
 * feels broken, and a church library is a few hundred rows.
 */
function renderLibrary(): void {
  const rows = latest?.library ?? [];
  const query = el.search.value.trim().toLowerCase();
  const shown =
    query === ""
      ? rows
      : rows.filter((row) =>
          `${row.title} ${row.subtitle ?? ""}`.toLowerCase().includes(query),
        );

  el.library.replaceChildren();
  for (const row of shown) {
    const item = document.createElement("li");
    if (row.id === draft?.id) item.dataset["open"] = "true";
    if (row.id === latest?.presentingId) item.dataset["live"] = "true";

    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", () => {
      commit();
      send({ type: "openItem", itemId: row.id });
    });

    const line = document.createElement("span");
    line.className = "row-line";

    const kind = document.createElement("span");
    kind.className = "row-kind";
    kind.dataset["kind"] = row.kind;
    kind.textContent = KINDS[row.kind];
    line.append(kind);

    const title = document.createElement("span");
    title.className = "row-title";
    title.textContent = row.title;
    line.append(title);
    button.append(line);

    const facts = document.createElement("span");
    facts.className = "row-facts";
    const detail = [countOf(row.kind, row.count)];
    if (row.subtitle !== null) detail.push(row.subtitle);
    if (row.id === latest?.presentingId) detail.push("on screen");
    if (row.origin === "hearth") detail.push("from Hearth");
    facts.textContent = detail.join("  ·  ");
    button.append(facts);

    item.append(button);
    el.library.append(item);
  }

  el.libraryEmpty.hidden = shown.length > 0;
  el.libraryEmpty.textContent =
    rows.length === 0 ? "Nothing saved yet" : "Nothing matches that";
}

/** What a problem code says on screen. The codes come from the model. */
const MESSAGES: Record<string, string> = {
  "title.missing": "Give it a title",
  "slide.lines.empty": "A slide has no words",
  "slide.lines.containsNewline": "A line holds a line break",
  "slide.presentation.mismatch": "A slide belongs to something else",
  "kind.unknown": "That kind of presentation is unknown",
};

function paint(next: EditorState): void {
  saving = false;
  latest = next;

  if (next.editing === null) {
    draft = null;
  } else if (draft === null || draft.serial !== next.editing.serial) {
    // A different presentation, or a new one. This is the only moment the
    // window replaces what is in its boxes.
    draft = {
      id: next.editing.id,
      serial: next.editing.serial,
      kind: next.editing.kind,
      title: next.editing.title,
      slides: next.editing.slides.map((slide) => ({ ...slide })),
      readOnly: next.editing.readOnly,
    };
    removed = null;
    el.title.value = draft.title;
    renderSlides();
  } else {
    // The same presentation coming back from a save. The id is picked up, and
    // everything else on screen is left where the person put it.
    draft.id = next.editing.id;
    draft.kind = next.editing.kind;
    draft.readOnly = next.editing.readOnly;
  }

  renderLibrary();

  el.problems.replaceChildren();
  for (const problem of next.problems) {
    const item = document.createElement("li");
    item.textContent = MESSAGES[problem.code] ?? problem.code;
    if (problem.detail !== "") item.textContent += ` (${problem.detail})`;
    el.problems.append(item);
  }

  paintStatus();
}

// Wiring

el.title.addEventListener("input", () => {
  if (draft === null) return;
  draft.title = el.title.value;
  paintStatus();
  schedule();
});
el.title.addEventListener("blur", commit);
el.title.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  commit();
  const first = el.slides.querySelector<HTMLTextAreaElement>("#body-0");
  if (first === null) el.add.focus();
  else first.focus();
});

el.search.addEventListener("input", renderLibrary);
el.add.addEventListener("click", () => addSlide());
el.undo.addEventListener("click", undoRemoval);
el.newButton.addEventListener("click", () => {
  commit();
  send({ type: "newPresentation" });
});
el.present.addEventListener("click", () => {
  commit();
  const id = draft?.id;
  if (id !== undefined && id !== null) send({ type: "presentNow", presentationId: id });
});

window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    commit();
  }
});

// A window closing mid sentence stores what is in it.
window.addEventListener("beforeunload", commit);
window.addEventListener("blur", commit);

if (bridge !== undefined) {
  bridge.onEditorState(paint);
  void bridge.hello().then((hello) => {
    if (hello.editor !== null) paint(hello.editor);
  });
}
