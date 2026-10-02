/**
 * STG-145, ST2.16. Where a person types slides.
 *
 * The person here is Daniel on a Tuesday evening with the sermon outline in
 * another window. So: one box, a blank line between slides, and the slides
 * appear beside him as he types. Nothing to learn, and nothing to drag.
 *
 * Same contract as the control surface. State comes down whole and the window
 * is a function of it. The one thing held locally is the text being typed,
 * because a keystroke is not worth a round trip, and every change from main
 * arrives with a new revision and reloads the box.
 */

import { parseSlides } from "@hearth/songs";
import type { EditorState, Intent } from "@hearth/stage-protocol";

const bridge = window.hearth;

const el = {
  library: document.getElementById("library") as HTMLOListElement,
  libraryEmpty: document.getElementById("library-empty") as HTMLParagraphElement,
  title: document.getElementById("title") as HTMLInputElement,
  text: document.getElementById("text") as HTMLTextAreaElement,
  preview: document.getElementById("preview") as HTMLOListElement,
  problems: document.getElementById("problems") as HTMLUListElement,
  status: document.getElementById("status") as HTMLParagraphElement,
  newButton: document.getElementById("new") as HTMLButtonElement,
  save: document.getElementById("save") as HTMLButtonElement,
  present: document.getElementById("present") as HTMLButtonElement,
};

let current: EditorState | null = null;
/** The revision whose text is in the box, so a save does not wipe typing. */
let loaded = -1;
let dirty = false;

function send(intent: Intent): void {
  bridge?.send(intent);
}

/**
 * The slides, as the room will see them.
 *
 * Parsed with the same function the save path uses, so the preview cannot
 * disagree with what gets stored. Breaking a slide that is too long for the
 * screen happens in the deck compiler, which needs the theme, so a slide here
 * is one card.
 */
function paintPreview(): void {
  const slides = parseSlides(el.text.value, { presentationId: "preview" });
  el.preview.replaceChildren();

  for (const slide of slides) {
    const item = document.createElement("li");
    const card = document.createElement("div");
    card.className = "card";

    const number = document.createElement("span");
    number.className = "card-number";
    number.textContent = String(slide.sortOrder + 1);
    card.append(number);

    if (slide.label !== null) {
      const label = document.createElement("span");
      label.className = "card-label";
      label.textContent = slide.label;
      card.append(label);
    }

    for (const line of slide.lines) {
      const paragraph = document.createElement("p");
      paragraph.className = "card-line";
      paragraph.textContent = line;
      card.append(paragraph);
    }

    item.append(card);
    el.preview.append(item);
  }

  const count = slides.length;
  el.status.textContent =
    count === 0 ? "" : `${count} slide${count === 1 ? "" : "s"}${dirty ? ", unsaved" : ""}`;
}

function paintProblems(state: EditorState): void {
  el.problems.replaceChildren();
  for (const problem of state.problems) {
    const item = document.createElement("li");
    item.textContent = MESSAGES[problem.code] ?? problem.code;
    if (problem.detail !== "") item.textContent += ` (${problem.detail})`;
    el.problems.append(item);
  }
}

/**
 * What a problem code says on screen.
 *
 * A short map rather than the catalogue in `packages/i18n`, because this window
 * is plain DOM and wiring the typed catalogue into it is part of the render
 * stories. The codes come from `validatePresentation`.
 */
const MESSAGES: Record<string, string> = {
  "title.missing": "Give it a title",
  "slides.none": "Type at least one slide",
  "slide.lines.empty": "A slide has no words",
  "slide.lines.containsNewline": "A line holds a line break",
  "slide.presentation.mismatch": "A slide belongs to something else",
  "kind.unknown": "That kind of presentation is unknown",
};

function paint(state: EditorState): void {
  current = state;

  el.library.replaceChildren();
  for (const row of state.library) {
    const item = document.createElement("li");
    if (row.id === state.editing?.id) item.dataset["open"] = "true";
    if (row.id === state.presentingId) item.dataset["live"] = "true";

    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", () =>
      send({ type: "editPresentation", presentationId: row.id }),
    );

    const title = document.createElement("span");
    title.className = "row-title";
    title.textContent = row.title;
    button.append(title);

    const facts = document.createElement("span");
    facts.className = "row-facts";
    const parts = [`${row.slideCount} slide${row.slideCount === 1 ? "" : "s"}`];
    if (row.id === state.presentingId) parts.push("on screen");
    if (row.origin === "hearth") parts.push("from Hearth");
    facts.textContent = parts.join("  ·  ");
    button.append(facts);

    item.append(button);
    el.library.append(item);
  }
  el.libraryEmpty.hidden = state.library.length > 0;

  // A revision the box has not seen is a change from main: a save, or a
  // different presentation opened. Anything typed since is already in it.
  if (state.revision !== loaded) {
    loaded = state.revision;
    dirty = false;
    el.title.value = state.editing?.title ?? "";
    el.text.value = state.editing?.text ?? "";
  }

  const readOnly = state.editing?.readOnly ?? false;
  el.title.readOnly = readOnly;
  el.text.readOnly = readOnly;
  el.save.disabled = readOnly || state.editing === null;
  el.present.disabled = state.editing?.id === null || state.editing === null;

  paintProblems(state);
  paintPreview();
}

function save(): void {
  if (el.save.disabled) return;
  send({
    type: "savePresentation",
    presentationId: current?.editing?.id ?? null,
    title: el.title.value,
    text: el.text.value,
  });
}

el.newButton.addEventListener("click", () => send({ type: "newPresentation" }));
el.save.addEventListener("click", save);
el.present.addEventListener("click", () => {
  // Saved first, so what reaches the wall is what is on the screen here. Main
  // handles the two intents in the order they are sent.
  if (dirty) save();
  const id = current?.editing?.id;
  if (id !== undefined && id !== null) send({ type: "presentNow", presentationId: id });
});

for (const field of [el.title, el.text]) {
  field.addEventListener("input", () => {
    dirty = true;
    paintPreview();
  });
}

window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    save();
  }
});

if (bridge !== undefined) {
  bridge.onEditorState(paint);
  void bridge.hello().then((state) => {
    if (state.editor !== null) paint(state.editor);
  });
}
