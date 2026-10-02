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

import type {
  Blank,
  ControlState,
  CueView,
  Intent,
  RunChange,
  SlideView,
} from "@hearth/stage-protocol";
import { FitCache } from "../output/fit";
import { applyTheme, createRuler, renderSlide, sizeFor, coverInto } from "../output/slide";
import { fillText, plural, t, type MessageKey } from "../shared/text";
import { icon } from "../shared/icons";

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
  resetRun: document.getElementById("reset-run") as HTMLButtonElement,
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
  const named = item === "" ? t("problem.anItem") : t("problem.named", { item });
  switch (code) {
    case "item.song.missing":
    case "item.presentation.missing":
      return t("problem.notInLibrary", { item: named });
    case "item.song.noSlides":
      return t("problem.noWords", { item: named });
    case "item.presentation.noSlides":
      return t("problem.noSlides", { item: named });
    case "item.scripture.empty":
      return t("problem.noText", { item: named });
    case "arrangement.none":
      return t("problem.noArrangement", { item: named });
    case "arrangement.unknown":
      return t("problem.unknownArrangement", { item: named });
    case "sequence.empty":
      return t("problem.emptySequence", { item: named });
    case "sequence.unknownLabel":
      return t("problem.unknownLabel", { item: named });
    default:
      return t("problem.unknownCode", { item: named, code });
  }
}

/**
 * The operator brief, on the screen rather than in a manual (ST12.10).
 *
 * This is what the sixteen year old reads at 10:28, so it is four keys and it
 * is always visible.
 */
const KEYS: [MessageKey, MessageKey][] = [
  ["keys.next", "keys.next.meaning"],
  ["keys.back", "keys.back.meaning"],
  ["keys.black", "keys.black.meaning"],
  ["keys.clear", "keys.clear.meaning"],
  ["keys.logo", "keys.logo.meaning"],
  ["keys.escape", "keys.escape.meaning"],
];

function send(intent: Intent): void {
  bridge?.send(intent);
}

/** The church's logo, pushed on its own channel (STG-22). */
let logo: string | null = null;
/** The last state painted, so a logo arriving later can be drawn into it. */
let latest: ControlState | null = null;

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
  coverInto(cover, blank, logo);
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
  quiet.textContent = t("control.nothingOnScreen");

  const over = document.createElement("div");
  over.className = "pane-marker";
  over.append(marker, quiet);
  target.append(over);
}

function groupTitle(state: ControlState, groupId: string): string {
  return state.groups.find((group) => group.id === groupId)?.title ?? "";
}

function metaFor(state: ControlState, cue: CueView | null): string {
  if (cue === null) return t("control.endOfService");
  const group = state.groups.find((candidate) => candidate.id === cue.groupId);
  const parts: string[] = [];
  if (group !== undefined) parts.push(group.title);
  if (cue.label !== null) {
    parts.push(
      cue.occurrencesTotal > 1
        ? t("cue.occurrence", {
            label: cue.label,
            occurrence: cue.occurrence,
            total: cue.occurrencesTotal,
          })
        : cue.label,
    );
  }
  if (cue.slideCount > 1)
    parts.push(t("cue.slideOf", { at: cue.slideIndex + 1, count: cue.slideCount }));
  if (group?.key != null) parts.push(t("cue.key", { key: group.key }));
  return parts.join(t("control.separator"));
}

function paint(state: ControlState): void {
  latest = state;
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
      : [
          state.service.date,
          t(state.service.source === "set_list" ? "control.setList" : "control.hearthPlan"),
          plural("control.cues", state.cues.length),
        ].join(t("control.separator"));

  // What is live, whether the output is black, and the time, visible at all
  // times (ST12.6).
  el.status.replaceChildren();
  const blank = document.createElement("span");
  blank.className = "chip";
  blank.dataset["blank"] = state.blank;
  blank.textContent =
    state.blank === "none"
      ? t("status.onScreen")
      : state.blank === "black"
        ? t("status.black")
        : state.blank === "clear"
          ? t("status.cleared")
          : t("status.logo");
  el.status.append(blank);

  for (const output of state.outputs) {
    const chip = document.createElement("span");
    chip.className = "chip quiet-chip";
    chip.textContent = t("status.output", { name: output.name, display: output.display });
    el.status.append(chip);
  }

  if (state.problems.length > 0) {
    const chip = document.createElement("span");
    chip.className = "chip problem";
    chip.textContent = plural("status.problems", state.problems.length);
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
    where.textContent = t("control.notes.here");
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
    item.textContent = t("control.notes.none");
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
      detail.textContent = facts.join(t("control.separator"));
      heading.append(detail);
    }
    groupItem.append(heading);

    const cues = document.createElement("ol");
    cues.className = "cues";
    for (const entryId of cueGroup.entryIds) {
      const cue = state.cues.find((candidate) => candidate.entryId === entryId);
      if (cue === undefined) continue;

      const item = document.createElement("li");
      item.className = "cue";
      if (cue.skipped) item.dataset["skipped"] = "true";
      if (cue.repeat) item.dataset["repeat"] = "true";
      if (cue.position === state.position) item.dataset["live"] = "true";

      const button = document.createElement("button");
      button.type = "button";
      // Pointer is optional, so every cue is also reachable by tabbing.
      button.addEventListener("click", () => send({ type: "goToCue", cueId: cue.entryId }));
      // A cue that is out of this run is not somewhere the service goes. It
      // stays in the list, visibly, because the operator has to be able to see
      // what they took out and put it back.
      button.disabled = cue.skipped;

      const tag = document.createElement("span");
      tag.className = "cue-tag";
      // A marker gets no tag. Its row says what it is, and a dash standing in
      // for a label reads as a label nobody filled in.
      tag.textContent =
        cue.kind === "marker"
          ? ""
          : cue.label === null
            ? "\u00b6"
            : cue.occurrencesTotal > 1
              ? `${cue.label}\u00b7${cue.occurrence}`
              : cue.label;
      button.append(tag);

      const text = document.createElement("span");
      text.className = "cue-text";
      text.textContent = cue.kind === "marker" ? t("control.nothingOnScreen") : (cue.preview ?? "");
      button.append(text);

      if (cue.slideCount > 1) {
        const of = document.createElement("span");
        of.className = "cue-of";
        of.textContent = t("cue.slideCount", { at: cue.slideIndex + 1, count: cue.slideCount });
        button.append(of);
      }

      item.append(button);
      item.append(runButtons(cue));
      cues.append(item);
    }
    groupItem.append(cues);
    el.deck.append(groupItem);
  }

  // Shown only once the run has left the set list, so an operator who has
  // changed nothing has nothing extra on the screen.
  el.resetRun.hidden = state.asPlanned;

  const liveElement = el.deck.querySelector('[data-live="true"]');
  liveElement?.scrollIntoView({ block: "nearest" });
}

/**
 * What an operator does to a cue mid service (STG-24, ST5.7).
 *
 * Four small buttons on every row, each carrying its name, because the whole
 * point is that the change is made in the half minute while the preacher is
 * still talking. None of it reaches the set list.
 */
function runButtons(cue: CueView): HTMLElement {
  const buttons = document.createElement("span");
  buttons.className = "cue-buttons";

  const kinds: [MessageKey, Parameters<typeof icon>[0], RunChange, boolean][] = [
    ["run.up", "chevron-up", "up", true],
    ["run.down", "chevron-down", "down", true],
    [cue.skipped ? "run.unskip" : "run.skip", "skip", "skip", true],
    ["run.repeat", "repeat", "repeat", !cue.repeat],
    ["run.drop", "minus", "drop", cue.repeat],
  ];

  for (const [name, mark, change, shown] of kinds) {
    if (!shown) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon";
    button.setAttribute("aria-label", t(name));
    button.title = t(name);
    button.append(icon(mark));
    button.addEventListener("click", () =>
      send({ type: "runChange", entryId: cue.entryId, change }),
    );
    buttons.append(button);
  }

  return buttons;
}

function brief(): void {
  el.keys.replaceChildren();
  for (const [key, meaning] of KEYS) {
    const term = document.createElement("dt");
    term.textContent = t(key);
    const detail = document.createElement("dd");
    detail.textContent = t(meaning);
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

// The words, before anything paints over them (STG-13).
fillText();
brief();
// The one thing on this surface that is not an advance. It opens a window and
// changes nothing on the wall, so it is safe to have in reach (ST12.3).
el.slides.addEventListener("click", () => send({ type: "openEditor" }));
el.home.addEventListener("click", () => send({ type: "closeService" }));
el.resetRun.addEventListener("click", () => send({ type: "resetRun" }));
el.waySlide.addEventListener("click", () => send({ type: "makeSlide" }));
el.wayLibrary.addEventListener("click", () => send({ type: "openLibrary" }));
el.waySample.addEventListener("click", () => send({ type: "openSample" }));
window.addEventListener("keydown", onKey);

if (bridge !== undefined) {
  bridge.onControlState(paint);
  bridge.onLogo((mark) => {
    logo = mark;
    if (latest !== null) paint(latest);
  });
  void bridge.hello().then((state) => {
    if (state.control !== null) paint(state.control);
  });
}
