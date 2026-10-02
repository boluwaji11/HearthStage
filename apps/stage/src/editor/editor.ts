/**
 * STG-145, STG-146, STG-7, ST2.16. Where a person builds what goes on screen.
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
 * when a different thing is opened. A save comes back with the serial
 * unchanged, so storing what somebody typed never rewrites what they are still
 * typing.
 *
 * **Two views, one at a time.** The window opens on the library as tiles, and
 * opening one fills the window with it. A sidebar beside an editor spends a
 * third of a laptop screen on a list nobody is reading while they type.
 *
 * **A song is a thing with slides.** The cards are identical whichever it is.
 * A song carries its credits as well, because a licensed song has to show them,
 * and what kind of section a slide is rides along without being asked about.
 *
 * **A song carries its orders** (STG-9). A church sings the same song two ways,
 * and the order is a list of slide titles. The key and the tempo an order can
 * hold are not asked for here: nothing transposes yet, so a key on this screen
 * would be a word in a box.
 */

import {
  formatSequence,
  labelsFor,
  parseSequence,
  proposeSplit,
  type SplitProposal,
} from "@hearth/songs";
import {
  gradientCss,
  type EditorState,
  type Intent,
  type LibraryItem,
  type LibraryKind,
  type OrderDraft,
  type SlideDraft,
  type SongFields,
  type ThemeChoice,
} from "@hearth/stage-protocol";
import { icon } from "./icons";

const bridge = window.hearth;

const el = {
  libraryView: document.getElementById("library-view") as HTMLElement,
  editView: document.getElementById("edit-view") as HTMLElement,
  tiles: document.getElementById("tiles") as HTMLOListElement,
  libraryEmpty: document.getElementById("library-empty") as HTMLParagraphElement,
  addSamples: document.getElementById("add-samples") as HTMLButtonElement,
  search: document.getElementById("search") as HTMLInputElement,
  back: document.getElementById("back") as HTMLButtonElement,
  toService: document.getElementById("to-service") as HTMLButtonElement,
  title: document.getElementById("title") as HTMLInputElement,
  theme: document.getElementById("theme") as HTMLSelectElement,
  credits: document.getElementById("credits") as HTMLElement,
  author: document.getElementById("author") as HTMLInputElement,
  year: document.getElementById("year") as HTMLInputElement,
  ccli: document.getElementById("ccli") as HTMLInputElement,
  copyright: document.getElementById("copyright") as HTMLInputElement,
  publicDomain: document.getElementById("public-domain") as HTMLInputElement,
  slides: document.getElementById("slides") as HTMLOListElement,
  add: document.getElementById("add") as HTMLButtonElement,
  paste: document.getElementById("paste") as HTMLButtonElement,
  orders: document.getElementById("orders") as HTMLElement,
  orderList: document.getElementById("order-list") as HTMLOListElement,
  addOrder: document.getElementById("add-order") as HTMLButtonElement,
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
  themeId: string | null;
  song: SongFields | null;
  orders: OrderDraft[];
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
/**
 * One slide, copied, waiting to be put somewhere (STG-147).
 *
 * Held in the window rather than in main. Switching presentations repaints this
 * window without reloading it, so a copy survives the trip, and a clipboard is
 * the kind of thing a person expects to lose when they close the window it
 * belongs to.
 */
let copied: SlideDraft | null = null;
/** A pasted block, waiting for somebody to say whether the split is right. */
let proposal: { index: number; split: SplitProposal; text: string } | null = null;
/** Slides whose note box is open although the note is still empty. */
const noteOpen = new Set<number>();

function toggleNote(index: number): void {
  if (noteOpen.has(index)) noteOpen.delete(index);
  else noteOpen.add(index);
  renderSlides();
  const field = el.slides.querySelector<HTMLInputElement>(`#note-${index}`);
  field?.focus();
}

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

  if (draft.song !== null || draft.kind === "song") {
    send({
      type: "saveSong",
      songId: draft.id,
      title: draft.title,
      fields: draft.song ?? blankFields(),
      sections: draft.slides,
      orders: draft.orders,
    });
    return;
  }

  send({
    type: "savePresentation",
    presentationId: draft.id,
    title: draft.title,
    slides: draft.slides,
    themeId: draft.themeId,
  });
}

function blankFields(): SongFields {
  return {
    author: "",
    composer: "",
    copyrightLine: "",
    ccliNumber: "",
    year: "",
    isPublicDomain: false,
    defaultKey: "",
  };
}

// The draft

function addSlide(after?: number): void {
  if (draft === null || draft.readOnly) return;
  const at = after === undefined ? draft.slides.length : after + 1;
  draft.slides.splice(at, 0, { label: null, body: "", note: null });
  removed = null;
  noteOpen.clear();
  renderSlides(at);
  schedule();
}

function duplicateSlide(index: number): void {
  if (draft === null || draft.readOnly) return;
  const slide = draft.slides[index];
  if (slide === undefined) return;
  draft.slides.splice(index + 1, 0, { ...slide });
  removed = null;
  noteOpen.clear();
  renderSlides(index + 1);
  schedule();
}

function copySlide(index: number): void {
  const slide = draft?.slides[index];
  if (slide === undefined) return;
  copied = { ...slide };
  paintStatus();
}

/** Puts the copied slide at the end, which is where a person is looking. */
function pasteSlide(): void {
  if (draft === null || draft.readOnly || copied === null) return;
  draft.slides.push({ ...copied });
  removed = null;
  noteOpen.clear();
  renderSlides(draft.slides.length - 1);
  schedule();
}

function removeSlide(index: number): void {
  if (draft === null || draft.readOnly) return;
  // Kept whole rather than by index, so undo puts the list back exactly.
  removed = { slides: draft.slides.map((slide) => ({ ...slide })), what: `Slide ${index + 1}` };
  draft.slides.splice(index, 1);
  noteOpen.clear();
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
  noteOpen.clear();
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

  const hints = labelHints();

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
    labelFor.textContent = "Slide title";
    head.append(labelFor);

    const label = document.createElement("input");
    label.className = "card-label";
    label.id = `label-${index}`;
    label.type = "text";
    label.autocomplete = "off";
    label.value = slide.label ?? "";
    // The name an order refers to, where nobody has typed one. It is the thing
    // a leader types into an order, so it has to be visible before it is saved.
    label.placeholder = hints[index] ?? "";
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
      ["Duplicate", "copy", () => duplicateSlide(index), !(draft?.readOnly ?? false)],
      ["Copy", "clipboard", () => copySlide(index), true],
      ["Note", "note", () => toggleNote(index), !(draft?.readOnly ?? false)],
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

    // Shown when there is a note, or when somebody asked for one. A box every
    // slide carries and almost none uses would be most of the card.
    if ((slide.note ?? "") !== "" || noteOpen.has(index)) {
      const row = document.createElement("div");
      row.className = "card-note-field";

      const noteFor = document.createElement("label");
      noteFor.htmlFor = `note-${index}`;
      noteFor.textContent = "Note";
      row.append(noteFor);

      const field = document.createElement("input");
      field.id = `note-${index}`;
      field.type = "text";
      field.autocomplete = "off";
      field.value = slide.note ?? "";
      field.readOnly = draft?.readOnly ?? false;
      field.addEventListener("input", () => {
        slide.note = field.value === "" ? null : field.value;
        schedule();
      });
      field.addEventListener("blur", commit);
      row.append(field);
      item.append(row);
    }

    item.append(note(slide));
    proposalInto(item, index);
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
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
    event.preventDefault();
    commit();
    duplicateSlide(index);
    return;
  }

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
 * A block of words dropped in from somewhere else (STG-8, ST2.2).
 *
 * Only into an empty box. A paste into a box that already has words behaves the
 * way a paste behaves everywhere else, and there is nothing in an empty box to
 * be surprised by.
 *
 * **It proposes and waits.** The split is shown with what it was based on, and
 * nothing happens until somebody presses one of the two buttons. A splitter
 * that guessed silently would put a chorus in the middle of a verse on a wall,
 * and the person who pasted it would have no idea why.
 */
function onPaste(event: ClipboardEvent, index: number, body: HTMLTextAreaElement): void {
  if (draft === null || draft.readOnly) return;
  if (body.value !== "") return;

  const text = event.clipboardData?.getData("text/plain") ?? "";
  const split = proposeSplit(text);
  if (split.sections.length < 2) return;

  event.preventDefault();
  proposal = { index, split, text };
  renderSlides(index);
}

/** What the split was based on, said plainly. */
function reasonSays(split: SplitProposal): string {
  switch (split.reason) {
    case "markers":
      return "Split where the words said Verse and Chorus";
    case "blank-lines":
      return "Split at the blank lines";
    case "line-count":
      return `Split every four lines, which is a guess`;
    default:
      return "";
  }
}

/** The proposal, under the box it was pasted into. */
function proposalInto(item: HTMLElement, index: number): void {
  if (proposal === null || proposal.index !== index) return;
  const { split } = proposal;

  const panel = document.createElement("div");
  panel.className = "proposal";
  if (split.guessed) panel.dataset["guessed"] = "true";

  const what = document.createElement("p");
  what.className = "proposal-what";
  what.textContent = `${split.sections.length} slides. ${reasonSays(split)}`;
  panel.append(what);

  const list = document.createElement("ol");
  list.className = "proposal-list";
  for (const section of split.sections) {
    const row = document.createElement("li");
    if (section.label !== null) {
      const label = document.createElement("span");
      label.className = "proposal-label";
      label.textContent = section.label;
      row.append(label);
    }
    row.append(document.createTextNode(section.lines[0] ?? ""));
    list.append(row);
  }
  panel.append(list);

  const buttons = document.createElement("div");
  buttons.className = "proposal-buttons";

  const accept = document.createElement("button");
  accept.type = "button";
  accept.className = "primary";
  accept.textContent = `Use these ${split.sections.length} slides`;
  accept.addEventListener("click", acceptProposal);

  const refuse = document.createElement("button");
  refuse.type = "button";
  refuse.textContent = "Keep as one";
  refuse.addEventListener("click", refuseProposal);

  buttons.append(accept, refuse);
  panel.append(buttons);
  item.append(panel);
}

function acceptProposal(): void {
  if (draft === null || proposal === null) return;
  const { index, split } = proposal;

  draft.slides.splice(
    index,
    1,
    ...split.sections.map((section) => ({
      label: section.label,
      body: section.lines.join("\n"),
      note: null,
      ...(section.sectionType === null ? {} : { sectionType: section.sectionType }),
    })),
  );
  proposal = null;
  removed = null;
  noteOpen.clear();
  renderSlides(index + split.sections.length - 1);
  commit();
}

function refuseProposal(): void {
  if (draft === null || proposal === null) return;
  const { index, text } = proposal;
  const slide = draft.slides[index];
  if (slide !== undefined) slide.body = text.trim();
  proposal = null;
  renderSlides(index);
  commit();
}

/**
 * The title each slide goes by, lined up with the boxes on screen.
 *
 * Worked out the same way main works it out, from the same model function, so
 * the title shown on a card is the title the record is stored under. An empty
 * box gets none, because an empty box is dropped on the way to the library.
 */
function labelHints(): (string | null)[] {
  const current = draft;
  if (current === null) return [];
  const filled: number[] = [];
  current.slides.forEach((slide, index) => {
    if (slide.body.trim() !== "") filled.push(index);
  });
  const labels = labelsFor(filled.map((index) => current.slides[index] as SlideDraft));
  const out: (string | null)[] = current.slides.map(() => null);
  filled.forEach((index, n) => {
    out[index] = labels[n] ?? null;
  });
  return out;
}

/** The titles an order may refer to. */
function knownTitles(): string[] {
  return labelHints().filter((label): label is string => label !== null);
}

/**
 * The ways a song is sung (STG-9, ST2.3).
 *
 * Typed rather than assembled from chips. "V1 C V2 C B C" is how a leader says
 * it, it reorders by editing one field, and it is the whole order on one line
 * instead of eleven controls. A title the song does not have is said so under
 * the field, and main drops it rather than storing a song that cannot present.
 *
 * The default is a radio group, so the browser enforces the one thing the
 * record cannot do without: exactly one of them.
 */
let orderSignature = "";

function orderSignatureOf(): string {
  return `${knownTitles().join(" ")}|${(draft?.orders ?? []).length}|${draft?.serial ?? -1}`;
}

function renderOrders(): void {
  orderSignature = orderSignatureOf();
  el.orderList.replaceChildren();

  const current = draft;
  if (current === null) return;
  const titles = new Set(knownTitles());
  const locked = current.readOnly;

  current.orders.forEach((order, index) => {
    const item = document.createElement("li");
    item.className = "order";

    const nameField = document.createElement("div");
    nameField.className = "field";
    const nameFor = document.createElement("label");
    nameFor.htmlFor = `order-name-${index}`;
    nameFor.textContent = "Name";
    const name = document.createElement("input");
    name.id = `order-name-${index}`;
    name.type = "text";
    name.autocomplete = "off";
    name.value = order.name;
    name.readOnly = locked;
    name.addEventListener("input", () => {
      order.name = name.value;
      schedule();
    });
    name.addEventListener("blur", commit);
    nameField.append(nameFor, name);
    item.append(nameField);

    const seqField = document.createElement("div");
    seqField.className = "field grow";
    const seqFor = document.createElement("label");
    seqFor.htmlFor = `order-sequence-${index}`;
    seqFor.textContent = "Slides";
    const sequence = document.createElement("input");
    sequence.id = `order-sequence-${index}`;
    sequence.type = "text";
    sequence.autocomplete = "off";
    sequence.spellcheck = false;
    sequence.className = "order-sequence";
    sequence.value = formatSequence(order.sequence);
    sequence.readOnly = locked;
    sequence.addEventListener("input", () => {
      order.sequence = parseSequence(sequence.value);
      paintOrderProblems();
      schedule();
    });
    sequence.addEventListener("blur", commit);
    seqField.append(seqFor, sequence);
    item.append(seqField);

    const mark = document.createElement("label");
    mark.className = "check";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "default-order";
    radio.checked = order.isDefault;
    radio.disabled = locked;
    radio.addEventListener("change", () => {
      for (const other of current.orders) other.isDefault = other === order;
      commit();
    });
    mark.append(radio, document.createTextNode("Default"));
    item.append(mark);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon";
    remove.setAttribute("aria-label", "Remove order");
    remove.title = "Remove order";
    remove.append(icon("trash"));
    // The last one stays. A song with no order cannot present, and taking it
    // away would put one back under a name nobody chose.
    remove.disabled = locked || current.orders.length < 2;
    remove.addEventListener("click", () => removeOrder(index));
    item.append(remove);

    const wrong = document.createElement("p");
    wrong.className = "order-problem";
    wrong.id = `order-problem-${index}`;
    wrong.textContent = unknownIn(order, titles);
    item.append(wrong);

    el.orderList.append(item);
  });
}

/** The titles an order names that the song does not have. */
function unknownIn(order: OrderDraft, titles: Set<string>): string {
  const missing = [...new Set(order.sequence.filter((label) => !titles.has(label)))];
  if (missing.length === 0) return "";
  return missing.length === 1
    ? `${missing[0]} is not a slide title`
    : `${missing.join(", ")} are not slide titles`;
}

function paintOrderProblems(): void {
  const titles = new Set(knownTitles());
  (draft?.orders ?? []).forEach((order, index) => {
    const line = el.orderList.querySelector<HTMLElement>(`#order-problem-${index}`);
    if (line !== null) line.textContent = unknownIn(order, titles);
  });
}

function addOrder(): void {
  if (draft === null || draft.readOnly) return;
  // Every slide once, so the person takes slides out rather than typing them
  // all in. Taking four out of six is the thing they came here to do.
  draft.orders.push({
    name: `Order ${draft.orders.length + 1}`,
    sequence: knownTitles(),
    isDefault: false,
  });
  renderOrders();
  el.orderList.querySelector<HTMLInputElement>(`#order-name-${draft.orders.length - 1}`)?.focus();
  commit();
}

function removeOrder(index: number): void {
  if (draft === null || draft.readOnly || draft.orders.length < 2) return;
  const [gone] = draft.orders.splice(index, 1);
  // The default cannot leave with it, so the first one takes it.
  if (gone?.isDefault === true && draft.orders[0] !== undefined) {
    for (const order of draft.orders) order.isDefault = order === draft.orders[0];
  }
  renderOrders();
  commit();
}

/** Shown on a song. A sheet of notices is written for one week. */
function paintOrders(): void {
  const song = draft !== null && draft.kind === "song";
  el.orders.hidden = !song;
  el.addOrder.disabled = draft === null || draft.readOnly;
  if (!song) return;
  if (orderSignatureOf() !== orderSignature) renderOrders();
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

  if (copied !== null) parts.push("a slide copied");
  if (draft === null) parts.length = 0;
  else if (draft.readOnly) parts.push("from Hearth, read only");
  else if (draft.kind === "song") parts.push("a song");
  else if (draft.title.trim() === "") parts.push("needs a title");
  else if (saving) parts.push("saving");
  else if (draft.id !== null) parts.push("saved");

  el.status.textContent = parts.join("  ·  ");

  el.add.disabled = draft === null || draft.readOnly;
  el.paste.hidden = copied === null;
  el.paste.disabled = draft === null || draft.readOnly;
  el.present.disabled = draft === null || draft.id === null || slides === 0;
  el.title.readOnly = draft?.readOnly ?? false;

  el.undone.hidden = removed === null;
  el.undoneWhat.textContent = removed === null ? "" : `${removed.what} removed`;

  paintOrders();
}

/**
 * The looks on offer (STG-148, ST8.1).
 *
 * The list comes down with the state, so the window never holds a copy of the
 * themes and a theme added in main turns up here without a change to this file.
 * Changing it writes one field, which is the whole point of the story: the look
 * and the words are different things, and restyling cannot touch a slide.
 */
function renderThemes(): void {
  const themes: ThemeChoice[] = latest?.themes ?? [];
  const chosen = draft?.themeId ?? "";

  if (el.theme.dataset["built"] !== String(themes.length)) {
    el.theme.replaceChildren();
    const service = document.createElement("option");
    service.value = "";
    service.textContent = "The service's look";
    el.theme.append(service);
    for (const theme of themes) {
      const option = document.createElement("option");
      option.value = theme.id;
      option.textContent = theme.name;
      el.theme.append(option);
    }
    el.theme.dataset["built"] = String(themes.length);
  }

  el.theme.value = chosen;
  // A song takes the service's look. Giving a song its own is ST8.3.
  el.theme.disabled = draft === null || draft.readOnly || draft.kind === "song";

  // The cards are painted in the look they will be presented in, so the choice
  // is a thing somebody sees rather than a word they have to imagine.
  const live = themes.find((theme) => theme.id === draft?.themeId);
  const root = document.documentElement;
  root.style.setProperty("--slide-background", live?.background ?? "");
  root.style.setProperty(
    "--slide-image",
    live === undefined ? "none" : gradientCss(live.gradient, live.background),
  );
  root.style.setProperty("--slide-colour", live?.colour ?? "");
  root.style.setProperty("--slide-font", live?.fontFamily ?? "");
  root.style.setProperty("--slide-align", live?.textAlign ?? "left");
  document.body.dataset["themed"] = live === undefined ? "false" : "true";
}

/**
 * The credits on a song (STG-7, ST2.1).
 *
 * Shown on a song and absent on a set of slides, because a licensed song has to
 * carry its copyright line and its CCLI number and a sheet of notices has
 * nothing to carry. The slide boxes below are the same either way.
 */
function renderCredits(): void {
  const song = draft?.song ?? null;
  el.credits.hidden = song === null;
  if (song === null) return;

  el.author.value = song.author;
  el.year.value = song.year;
  el.ccli.value = song.ccliNumber;
  el.copyright.value = song.copyrightLine;
  el.publicDomain.checked = song.isPublicDomain;

  const locked = draft?.readOnly ?? false;
  for (const field of [el.author, el.year, el.ccli, el.copyright]) field.readOnly = locked;
  el.publicDomain.disabled = locked;
}

/** What the count means, which depends on what the row holds. */
function countOf(kind: LibraryKind, count: number): string {
  const noun = kind === "song" ? "section" : "slide";
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * The library as tiles (STG-146).
 *
 * A tile is the thing it opens: its first slide, in the look it is presented
 * in. A church recognises the notices by what they look like faster than by
 * reading a row in a list, and a wall of titles in one font is a filing cabinet.
 *
 * Filtered here rather than in main: a search box that waits for a round trip
 * feels broken, and a church library is a few hundred rows.
 */
function renderLibrary(): void {
  const rows = latest?.library ?? [];
  const themes = latest?.themes ?? [];
  const query = el.search.value.trim().toLowerCase();
  const shown =
    query === ""
      ? rows
      : rows.filter((row) =>
          `${row.title} ${row.subtitle ?? ""}`.toLowerCase().includes(query),
        );

  el.tiles.replaceChildren();
  for (const row of shown) el.tiles.append(tileFor(row, themes));

  el.libraryEmpty.hidden = shown.length > 0;
  el.libraryEmpty.textContent = rows.length === 0 ? "Nothing saved yet" : "Nothing matches that";

  // The hymns Stage carries (STG-10, ST1.2). It sits beside New, because a
  // church looking for something to sing is in this window, and it stays there
  // until somebody presses it. Nothing is written before that.
  const samples = latest?.samples ?? 0;
  el.addSamples.hidden = samples === 0;
  el.addSamples.textContent = `Add ${samples} hymns`;
}

function tileFor(row: LibraryItem, themes: ThemeChoice[]): HTMLLIElement {
  const item = document.createElement("li");
  if (row.id === latest?.presentingId) item.dataset["live"] = "true";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "tile";
  button.addEventListener("click", () => send({ type: "openItem", itemId: row.id }));

  // The first slide, in the look it is presented in. A thumbnail rather than a
  // rendering: the measured fit belongs on a screen somebody is reading from,
  // and running it for two hundred tiles would cost a second of layout.
  const look = themes.find((theme) => theme.id === row.themeId) ?? themes[0];
  const screen = document.createElement("span");
  screen.className = "tile-screen";
  if (look !== undefined) {
    screen.style.backgroundColor = look.background;
    screen.style.backgroundImage = gradientCss(look.gradient, look.background);
    screen.style.color = look.colour;
    screen.style.fontFamily = look.fontFamily;
    screen.style.textAlign = look.textAlign;
  }
  for (const line of row.preview.slice(0, 4)) {
    const paragraph = document.createElement("span");
    paragraph.className = "tile-line";
    paragraph.textContent = line;
    screen.append(paragraph);
  }
  button.append(screen);

  const title = document.createElement("span");
  title.className = "tile-title";
  title.textContent = row.title;
  button.append(title);

  const facts = document.createElement("span");
  facts.className = "tile-facts";
  const detail = [countOf(row.kind, row.count)];
  if (row.subtitle !== null) detail.push(row.subtitle);
  if (row.id === latest?.presentingId) detail.push("on screen");
  if (row.origin === "hearth") detail.push("from Hearth");
  facts.textContent = detail.join("  \u00b7  ");
  button.append(facts);

  item.append(button);
  return item;
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
      themeId: next.editing.themeId,
      song: next.editing.song,
      orders: next.editing.orders.map((order) => ({ ...order, sequence: [...order.sequence] })),
      readOnly: next.editing.readOnly,
    };
    removed = null;
    noteOpen.clear();
    el.title.value = draft.title;
    renderCredits();
    renderOrders();
    renderSlides();
  } else {
    // The same presentation coming back from a save. The id is picked up, and
    // everything else on screen is left where the person put it.
    draft.id = next.editing.id;
    draft.kind = next.editing.kind;
    draft.readOnly = next.editing.readOnly;
  }

  // One view at a time. The library is what the window opens on, and opening
  // something fills the window with it.
  el.libraryView.hidden = draft !== null;
  el.editView.hidden = draft === null;

  renderThemes();
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

type TextField = "author" | "year" | "ccliNumber" | "copyrightLine";

for (const [field, name] of [
  [el.author, "author"],
  [el.year, "year"],
  [el.ccli, "ccliNumber"],
  [el.copyright, "copyrightLine"],
] as [HTMLInputElement, TextField][]) {
  field.addEventListener("input", () => {
    if (draft?.song == null) return;
    draft.song[name] = field.value;
    schedule();
  });
  field.addEventListener("blur", commit);
}

el.publicDomain.addEventListener("change", () => {
  if (draft?.song == null) return;
  draft.song.isPublicDomain = el.publicDomain.checked;
  commit();
});

el.back.addEventListener("click", () => {
  commit();
  send({ type: "closeItem" });
});

// The editor is its own window and covers the one that presents, so there has
// to be a way back to it from in here.
el.toService.addEventListener("click", () => {
  commit();
  send({ type: "showControl" });
});

el.theme.addEventListener("change", () => {
  if (draft === null) return;
  draft.themeId = el.theme.value === "" ? null : el.theme.value;
  renderThemes();
  commit();
});
el.search.addEventListener("input", renderLibrary);
el.add.addEventListener("click", () => addSlide());
el.paste.addEventListener("click", pasteSlide);
el.addOrder.addEventListener("click", addOrder);
el.addSamples.addEventListener("click", () => send({ type: "addSamples" }));
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
