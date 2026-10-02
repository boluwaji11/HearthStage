/**
 * STG-11, STG-21, STG-22. The operator's surface.
 *
 * The person here is sixteen years old, has opened Stage twice, and the service
 * starts in two minutes. So: what is live, what is next, where we are in the
 * service, and four keys. Nothing destructive is reachable (ST12.3), because
 * the only thing this window can do is send an intent.
 *
 * Keyboard first and pointer optional (ST12.1). A full service runs with the
 * trackpad disconnected.
 */

import type { Blank, ControlState, CueView, Intent, SlideView } from "@hearth/stage-protocol";
import { FitCache } from "../output/fit";
import { applyTheme, createRuler, renderSlide, sizeFor } from "../output/slide";

const bridge = window.hearth;

const el = {
  service: document.getElementById("service") as HTMLElement,
  serviceDetail: document.getElementById("service-detail") as HTMLElement,
  status: document.getElementById("status") as HTMLElement,
  deck: document.getElementById("deck") as HTMLOListElement,
  live: document.getElementById("live") as HTMLElement,
  liveMeta: document.getElementById("live-meta") as HTMLElement,
  next: document.getElementById("next") as HTMLElement,
  nextMeta: document.getElementById("next-meta") as HTMLElement,
  notes: document.getElementById("notes") as HTMLUListElement,
  keys: document.getElementById("keys") as HTMLElement,
  slides: document.getElementById("slides") as HTMLButtonElement,
  home: document.getElementById("home") as HTMLButtonElement,
  problems: document.getElementById("problems") as HTMLUListElement,
  start: document.getElementById("start") as HTMLElement,
  running: document.getElementById("running") as HTMLElement,
  waySlide: document.getElementById("way-slide") as HTMLButtonElement,
  wayLibrary: document.getElementById("way-library") as HTMLButtonElement,
  waySample: document.getElementById("way-sample") as HTMLButtonElement,
};

/**
 * What a compile problem says to the person running the service (ST5.2).
 *
 * A code is for a log. The operator is sixteen and the service starts in two
 * minutes, so each one says which item and what is wrong with it. Written here
 * rather than in `packages/i18n` because this window is plain DOM, and wiring
 * the typed catalogue in is part of the render stories.
 */
function problemSays(code: string, item: string): string {
  const named = item === "" ? "An item" : `"${item}"`;
  switch (code) {
    case "item.song.missing":
      return `${named} is not in the library`;
    case "item.presentation.missing":
      return `${named} is not in the library`;
    case "item.song.noSlides":
      return `${named} has no words to put on the screen`;
    case "item.presentation.noSlides":
      return `${named} has no slides yet`;
    case "item.scripture.empty":
      return `${named} has no text`;
    case "arrangement.none":
      return `${named} has no arrangement`;
    case "arrangement.unknown":
      return `${named} asks for an arrangement that is not there`;
    case "sequence.empty":
      return `${named} has an arrangement with no order in it`;
    case "sequence.unknownLabel":
      return `${named} has an order naming a section it does not have`;
    default:
      return `${named} has a problem (${code})`;
  }
}

/**
 * The operator brief, on the screen rather than in a manual (ST12.10).
 *
 * This is what the sixteen year old reads at 10:28, so it is four keys and it
 * is always visible.
 */
const KEYS: [string, string][] = [
  ["Space  or  →", "Next"],
  ["←", "Back"],
  ["B", "Black the screen"],
  ["C", "Clear the words"],
  ["L", "Logo"],
  ["Esc", "Back to the slide"],
];

function send(intent: Intent): void {
  bridge?.send(intent);
}

const fitCache = new FitCache();
const ruler = createRuler();

/**
 * A pane painted as the room's slide, at the pane's size (STG-21).
 *
 * Same stylesheet, same renderer, same measured fit as the output window, and
 * the box is 16 by 9 so the proportions are the screen's. An operator deciding
 * whether to advance is deciding about what the room can see, and a first line
 * set in this window's own font answers a different question.
 */
function paintPane(target: HTMLElement, view: SlideView | null, blank: Blank): void {
  target.replaceChildren();

  if (view === null) {
    target.dataset["empty"] = "end";
    target.removeAttribute("style");
    return;
  }
  delete target.dataset["empty"];

  applyTheme(target, view.theme);

  const box = target.getBoundingClientRect();
  const size = sizeFor(view.content, view.theme, { width: box.width, height: box.height }, fitCache, ruler);
  if (size !== null) target.style.setProperty("--text-size", `${size}px`);

  target.append(renderSlide(view.content));

  // The cover goes on the live pane only. The next pane is what the keypress
  // will put there, which is the slide rather than the black over it.
  const cover = document.createElement("div");
  cover.className = "cover";
  cover.dataset["blank"] = blank;
  target.append(cover);
}

/**
 * What a marker puts in a pane.
 *
 * A marker puts nothing on the wall, so the pane would be an empty screen and
 * an empty screen looks like a fault. The operator is told which item it is and
 * that the screen is meant to be empty (ST5.4).
 */
function markerInto(target: HTMLElement, cue: CueView | null, state: ControlState): void {
  if (cue === null || cue.kind !== "marker") return;

  const marker = document.createElement("p");
  marker.className = "marker";
  marker.textContent = groupTitle(state, cue.groupId);

  const quiet = document.createElement("p");
  quiet.className = "marker-quiet";
  quiet.textContent = "Nothing on the screen";

  const over = document.createElement("div");
  over.className = "pane-marker";
  over.append(marker, quiet);
  target.append(over);
}

function groupTitle(state: ControlState, groupId: string): string {
  return state.groups.find((group) => group.id === groupId)?.title ?? "";
}

function metaFor(state: ControlState, cue: CueView | null): string {
  if (cue === null) return "End of the service";
  const group = state.groups.find((candidate) => candidate.id === cue.groupId);
  const parts: string[] = [];
  if (group !== undefined) parts.push(group.title);
  if (cue.label !== null) {
    parts.push(
      cue.occurrencesTotal > 1
        ? `${cue.label}, ${cue.occurrence} of ${cue.occurrencesTotal}`
        : cue.label,
    );
  }
  if (cue.slideCount > 1) parts.push(`slide ${cue.slideIndex + 1} of ${cue.slideCount}`);
  if (group?.key != null) parts.push(`key of ${group.key}`);
  return parts.join("  ·  ");
}

function paint(state: ControlState): void {
  // Nothing open means a church that has not started yet, or one between
  // services. Either way the three ways in belong on the screen rather than an
  // empty deck (STG-149, ST1.2).
  const open = state.service !== null;
  el.start.hidden = open;
  el.running.hidden = !open;
  // The way back. Without it a church that opened the sample to look at it is
  // left in it, and the three ways in are the only place the sample lives.
  el.home.hidden = !open;

  el.service.textContent = state.service?.title ?? "";
  el.serviceDetail.textContent =
    state.service === null
      ? ""
      : `${state.service.date}  ·  ${state.service.source === "set_list" ? "Stage set list" : "Hearth plan"}  ·  ${state.cues.length} cues`;

  // What is live, whether the output is black, and the time, visible at all
  // times (ST12.6).
  el.status.replaceChildren();
  const blank = document.createElement("span");
  blank.className = "chip";
  blank.dataset["blank"] = state.blank;
  blank.textContent =
    state.blank === "none"
      ? "On screen"
      : state.blank === "black"
        ? "Black"
        : state.blank === "clear"
          ? "Cleared"
          : "Logo";
  el.status.append(blank);

  for (const output of state.outputs) {
    const chip = document.createElement("span");
    chip.className = "chip quiet-chip";
    chip.textContent = `${output.name}: ${output.display}`;
    el.status.append(chip);
  }

  if (state.problems.length > 0) {
    const chip = document.createElement("span");
    chip.className = "chip problem";
    chip.textContent = `${state.problems.length} problem${state.problems.length === 1 ? "" : "s"}`;
    el.status.append(chip);
  }

  el.problems.replaceChildren();
  for (const problem of state.problems) {
    const item = document.createElement("li");
    item.textContent = problemSays(problem.code, problem.detail);
    el.problems.append(item);
  }

  const live = state.cues[state.position] ?? null;
  const next = state.cues[state.position + 1] ?? null;
  paintPane(el.live, state.live, state.blank);
  paintPane(el.next, state.next, "none");
  markerInto(el.live, live, state);
  markerInto(el.next, next, state);
  el.liveMeta.textContent = metaFor(state, live);
  el.nextMeta.textContent = metaFor(state, next);

  // Notes for the operator, global plus the ones addressed to a position
  // (ST5.5). Filtering by this operator's own position arrives with the plan.
  el.notes.replaceChildren();
  const group = state.groups.find((candidate) => candidate.id === live?.groupId);

  // The note on this slide comes first, because it is about what is on the
  // screen right now and an item note is about the whole song (ST2.19).
  if (live?.note != null && live.note !== "") {
    const item = document.createElement("li");
    const where = document.createElement("span");
    where.className = "note-position";
    where.textContent = "this slide";
    item.append(where, document.createTextNode(live.note));
    el.notes.append(item);
  }

  for (const note of group?.notes ?? []) {
    const item = document.createElement("li");
    if (note.position !== null) {
      const who = document.createElement("span");
      who.className = "note-position";
      who.textContent = note.position;
      item.append(who);
    }
    item.append(document.createTextNode(note.body));
    el.notes.append(item);
  }
  if (el.notes.children.length === 0) {
    const item = document.createElement("li");
    item.className = "quiet";
    item.textContent = "None";
    el.notes.append(item);
  }

  el.deck.replaceChildren();
  for (const cueGroup of state.groups) {
    const groupItem = document.createElement("li");
    groupItem.className = "group";

    const heading = document.createElement("div");
    heading.className = "group-heading";
    const title = document.createElement("span");
    title.className = "group-title";
    title.textContent = cueGroup.title;
    heading.append(title);

    const facts: string[] = [];
    if (cueGroup.key !== null) facts.push(cueGroup.key);
    if (cueGroup.sequence.length > 0) facts.push(cueGroup.sequence.join(" "));
    if (facts.length > 0) {
      const detail = document.createElement("span");
      detail.className = "group-facts";
      detail.textContent = facts.join("  ·  ");
      heading.append(detail);
    }
    groupItem.append(heading);

    const cues = document.createElement("ol");
    cues.className = "cues";
    for (const cueId of cueGroup.cueIds) {
      const cue = state.cues.find((candidate) => candidate.id === cueId);
      if (cue === undefined) continue;

      const item = document.createElement("li");
      item.className = "cue";
      if (cue.position === state.position) item.dataset["live"] = "true";
      if (cue.position === state.position + 1) item.dataset["next"] = "true";

      const button = document.createElement("button");
      button.type = "button";
      // Pointer is optional, so every cue is also reachable by tabbing.
      button.addEventListener("click", () => send({ type: "goToCue", cueId: cue.id }));

      const tag = document.createElement("span");
      tag.className = "cue-tag";
      // A marker gets no tag. Its row says what it is, and a dash standing in
      // for a label reads as a label nobody filled in.
      tag.textContent =
        cue.kind === "marker"
          ? ""
          : cue.label === null
            ? "¶"
            : cue.occurrencesTotal > 1
              ? `${cue.label}·${cue.occurrence}`
              : cue.label;
      button.append(tag);

      const text = document.createElement("span");
      text.className = "cue-text";
      text.textContent =
        cue.kind === "marker" ? "Nothing on the screen" : (cue.preview ?? "");
      button.append(text);

      if (cue.slideCount > 1) {
        const of = document.createElement("span");
        of.className = "cue-of";
        of.textContent = `${cue.slideIndex + 1}/${cue.slideCount}`;
        button.append(of);
      }

      item.append(button);
      cues.append(item);
    }
    groupItem.append(cues);
    el.deck.append(groupItem);
  }

  const liveElement = el.deck.querySelector('[data-live="true"]');
  liveElement?.scrollIntoView({ block: "nearest" });
}

function brief(): void {
  el.keys.replaceChildren();
  for (const [key, meaning] of KEYS) {
    const term = document.createElement("dt");
    term.textContent = key;
    const detail = document.createElement("dd");
    detail.textContent = meaning;
    el.keys.append(term, detail);
  }
}

/**
 * The keys.
 *
 * `repeat` is ignored, so holding the advance key moves one cue rather than
 * four (ST12.4).
 */
function onKey(event: KeyboardEvent): void {
  if (event.repeat) return;

  const blank = (mode: Blank): void => {
    event.preventDefault();
    send({ type: "toggleBlank", blank: mode });
  };

  switch (event.key) {
    case " ":
    case "ArrowRight":
    case "ArrowDown":
    case "PageDown":
      event.preventDefault();
      send({ type: "advance" });
      return;
    case "ArrowLeft":
    case "ArrowUp":
    case "PageUp":
      event.preventDefault();
      send({ type: "reverse" });
      return;
    case "Home":
      event.preventDefault();
      send({ type: "goTo", position: 0 });
      return;
    case "Escape":
      event.preventDefault();
      send({ type: "setBlank", blank: "none" });
      return;
    default:
      break;
  }

  switch (event.key.toLowerCase()) {
    case "b":
      blank("black");
      return;
    case "c":
      blank("clear");
      return;
    case "l":
      blank("logo");
      return;
    default:
      break;
  }
}

brief();
// The one thing on this surface that is not an advance. It opens a window and
// changes nothing on the wall, so it is safe to have in reach (ST12.3).
el.slides.addEventListener("click", () => send({ type: "openEditor" }));
el.home.addEventListener("click", () => send({ type: "closeService" }));
el.waySlide.addEventListener("click", () => send({ type: "makeSlide" }));
el.wayLibrary.addEventListener("click", () => send({ type: "openLibrary" }));
el.waySample.addEventListener("click", () => send({ type: "openSample" }));
window.addEventListener("keydown", onKey);

if (bridge !== undefined) {
  bridge.onControlState(paint);
  void bridge.hello().then((state) => {
    if (state.control !== null) paint(state.control);
  });
}
