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
import type { EditorState, Intent, SlideDraft } from "@hearth/stage-protocol";

const bridge = window.hearth;

const el = {
  library: document.getElementById("library") as HTMLOListElement,
  libraryEmpty: document.getElementById("library-empty") as HTMLParagraphElement,
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
  title: string;
  slides: SlideDraft[];
  readOnly: boolean;
}

let draft: Draft | null = null;
/** The slides as they were before the last removal, for one step of undo. */
let removed: { slides: SlideDraft[]; what: string } | null = null;
let timer: number | undefined;
let saving = false;

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

function moveSlide(index: number, by: number): void {
  if (draft === null || draft.readOnly) return;
  const to = index + by;
  if (to < 0 || to >= draft.slides.length) return;
  const [slide] = draft.slides.splice(index, 1);
  if (slide === undefined) return;
  draft.slides.splice(to, 0, slide);
  removed = null;
  renderSlides(to);
  schedule();
}

function undoRemoval(): void {
  if (draft === null || removed === null) return;
  draft.slides = removed.slides;
  removed = null;
  renderSlides();
  schedule();
}

// Painting

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

    const number = document.createElement("span");
    number.className = "card-number";
    number.textContent = String(index + 1);
    head.append(number);

    const labelFor = document.createElement("label");
    labelFor.className = "card-label-name";
    labelFor.htmlFor = `label-${index}`;
    labelFor.textContent = "Label";
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
    // Named rather than drawn. An icon-only button is refused
    // (docs/design-system.md section 12).
    for (const [text, action, usable] of [
      ["Up", () => moveSlide(index, -1), index > 0],
      ["Down", () => moveSlide(index, 1), index < draft!.slides.length - 1],
      ["Remove", () => removeSlide(index), true],
    ] as [string, () => void, boolean][]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "small";
      button.textContent = text;
      button.disabled = !usable || (draft?.readOnly ?? false);
      button.addEventListener("click", action);
      buttons.append(button);
    }
    head.append(buttons);
    item.append(head);

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

  if (next.editing === null) {
    draft = null;
  } else if (draft === null || draft.serial !== next.editing.serial) {
    // A different presentation, or a new one. This is the only moment the
    // window replaces what is in its boxes.
    draft = {
      id: next.editing.id,
      serial: next.editing.serial,
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
    draft.readOnly = next.editing.readOnly;
  }

  el.library.replaceChildren();
  for (const row of next.library) {
    const item = document.createElement("li");
    if (row.id === draft?.id) item.dataset["open"] = "true";
    if (row.id === next.presentingId) item.dataset["live"] = "true";

    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", () => {
      commit();
      send({ type: "editPresentation", presentationId: row.id });
    });

    const title = document.createElement("span");
    title.className = "row-title";
    title.textContent = row.title;
    button.append(title);

    const facts = document.createElement("span");
    facts.className = "row-facts";
    const detail = [`${row.slideCount} slide${row.slideCount === 1 ? "" : "s"}`];
    if (row.id === next.presentingId) detail.push("on screen");
    if (row.origin === "hearth") detail.push("from Hearth");
    facts.textContent = detail.join("  ·  ");
    button.append(facts);

    item.append(button);
    el.library.append(item);
  }
  el.libraryEmpty.hidden = next.library.length > 0;

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
