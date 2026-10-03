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
import { applyTheme, coverInto, createRuler, renderSlide, sizeFor, tickClocks } from "../output/slide";
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
  resetRun: document.getElementById("reset-run") as HTMLButtonElement,
  countdownSet: document.getElementById("countdown-set") as HTMLElement,
  countdown: document.getElementById("countdown") as HTMLDialogElement,
  countdownOpen: document.getElementById("countdown-open") as HTMLButtonElement,
  countdownClose: document.getElementById("countdown-close") as HTMLButtonElement,
  brief: document.getElementById("brief") as HTMLDialogElement,
  briefKeys: document.getElementById("brief-keys") as HTMLElement,
  briefOpen: document.getElementById("brief-open") as HTMLButtonElement,
  briefClose: document.getElementById("brief-close") as HTMLButtonElement,
  countdownLeft: document.getElementById("countdown-left") as HTMLParagraphElement,
  home: document.getElementById("home") as HTMLButtonElement,
  wayPlans: document.getElementById("way-plans") as HTMLButtonElement,
  problems: document.getElementById("problems") as HTMLUListElement,
  start: document.getElementById("start") as HTMLElement,
  running: document.getElementById("running") as HTMLElement,
  wayLibrary: document.getElementById("way-library") as HTMLButtonElement,
  waySettings: document.getElementById("way-settings") as HTMLButtonElement,
  startNext: document.getElementById("start-next") as HTMLButtonElement,
  startNextTitle: document.getElementById("start-next-title") as HTMLSpanElement,
  startNextDate: document.getElementById("start-next-date") as HTMLSpanElement,
  callOpen: document.getElementById("call-open") as HTMLButtonElement,
  call: document.getElementById("call") as HTMLDialogElement,
  callClose: document.getElementById("call-close") as HTMLButtonElement,
  callSearch: document.getElementById("call-search") as HTMLInputElement,
  callList: document.getElementById("call-list") as HTMLOListElement,
  callEmpty: document.getElementById("call-empty") as HTMLParagraphElement,
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
interface KeyRow {
  /** Every spelling that does this. Compared against `event.key`. */
  keys: string[];
  /** The one shown, which is the one a person would say. */
  label: MessageKey;
  meaning: MessageKey;
  /** The other spellings, named under the one a person would say. */
  also?: MessageKey;
  run: () => void;
}

/**
 * Every key the service window answers to (STG-27, ST12.10).
 *
 * One table drives both what the keys do and the card a volunteer opens at
 * 10:28. A key that works and is written down nowhere, or written down and no
 * longer working, is the failure this shape makes impossible rather than tests.
 */
const KEYS: KeyRow[] = [
  {
    keys: [" ", "ArrowRight", "ArrowDown", "PageDown"],
    label: "keys.next",
    meaning: "keys.next.meaning",
    also: "keys.next.also",
    run: () => send({ type: "advance" }),
  },
  {
    keys: ["ArrowLeft", "ArrowUp", "PageUp"],
    label: "keys.back",
    meaning: "keys.back.meaning",
    also: "keys.back.also",
    run: () => send({ type: "reverse" }),
  },
  {
    keys: ["Home"],
    label: "keys.first",
    meaning: "keys.first.meaning",
    run: () => send({ type: "goTo", position: 0 }),
  },
  {
    keys: ["b", "B"],
    label: "keys.black",
    meaning: "keys.black.meaning",
    run: () => send({ type: "toggleBlank", blank: "black" }),
  },
  {
    keys: ["c", "C"],
    label: "keys.clear",
    meaning: "keys.clear.meaning",
    run: () => send({ type: "toggleBlank", blank: "clear" }),
  },
  {
    keys: ["l", "L"],
    label: "keys.logo",
    meaning: "keys.logo.meaning",
    run: () => send({ type: "toggleBlank", blank: "logo" }),
  },
  {
    keys: ["Escape"],
    label: "keys.escape",
    meaning: "keys.escape.meaning",
    run: () => send({ type: "setBlank", blank: "none" }),
  },
  {
    keys: ["a", "A"],
    label: "keys.call",
    meaning: "keys.call.meaning",
    run: () => showCall(true),
  },
  {
    keys: ["?"],
    label: "keys.brief",
    meaning: "keys.brief.meaning",
    run: () => showBrief(true),
  },
];

/**
 * The plan to open on (STG-48, ST12.5).
 *
 * It takes the focus the first time it appears, so a volunteer who opened Stage
 * and reached for the keyboard starts the service without finding the mouse.
 * Taken once per plan rather than on every paint, because the state goes down
 * behind every keypress and stealing focus repeatedly would make the rest of
 * the screen unreachable.
 */
let focusedOn: string | null = null;

function paintNextUp(plan: ControlState["nextUp"]): void {
  el.startNext.hidden = plan === null;
  if (plan === null) {
    focusedOn = null;
    return;
  }

  el.startNextTitle.textContent = plan.title;
  el.startNextDate.textContent = whenItIs(plan.date);
  requestAnimationFrame(focusNextUp);
}

/**
 * Gives the plan the focus, once, while the landing page is on screen.
 *
 * Only while it is on screen, so somebody typing a hymn in the workbench keeps
 * their cursor. Once per plan, because the state goes down behind every
 * keypress and a focus call on each one would make the window unreachable.
 *
 * Called from the paint and again whenever the workbench opens or closes, since
 * that is the other half of this window and paints from its own state: either
 * can be the one that happens second, and this has to be right both ways.
 */
function focusNextUp(): void {
  const plan = latest?.nextUp ?? null;
  if (plan === null || el.startNext.offsetParent === null) {
    focusedOn = null;
    return;
  }
  if (focusedOn === plan.id) return;
  focusedOn = plan.id;
  el.startNext.focus();
}

/** A date a person reads, with today and tomorrow named rather than dated. */
function whenItIs(date: string): string {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = 24 * 60 * 60 * 1000;
  const parts = date.split("-").map(Number);
  const when = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1);
  const away = Math.round((when.getTime() - midnight.getTime()) / day);

  if (away === 0) return t("start.today");
  if (away === 1) return t("start.tomorrow");
  return when.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function send(intent: Intent): void {
  bridge?.send(intent);
}

/** The church's logo, pushed on its own channel (STG-22). */
let logo: string | null = null;
/** The last state painted, so a logo arriving later can be drawn into it. */
let latest: ControlState | null = null;
/** Running while a clock is on screen, and stopped the moment it is not. */
let ticking: (() => void) | null = null;

/** How long a church puts a clock up for, and how much more it adds. */
const COUNTDOWNS = [5, 10, 15, 20, 30];
const MORE = [1, 5];

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
    // Said here rather than in the stylesheet. Copy in a `content` rule is copy
    // a translator cannot reach (STG-13).
    const end = document.createElement("p");
    end.className = "screen-empty";
    end.textContent = t("control.endOfService");
    target.append(end);
    return;
  }
  delete target.dataset["empty"];

  applyTheme(target, view.theme);

  const box = target.getBoundingClientRect();
  const size = sizeFor(view.content, view.theme, { width: box.width, height: box.height }, fitCache, ruler);
  // Always in pixels, and always worked out from the pane rather than from this
  // window. A theme's own size is a fraction of the output's height, which the
  // output window turns into `vh`. In here `vh` is the control window and a
  // percentage is the parent's font size, so a cue nothing measures, a reading
  // or a marker, came out at a fraction of a pixel.
  target.style.setProperty(
    "--text-size",
    `${size ?? view.theme.textSize * box.height}px`,
  );

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
  // Nothing to add to until something is running (STG-49).
  el.callOpen.hidden = !open;
  if (!open) showCall(false);
  // After the landing page's own visibility, because taking the focus depends
  // on whether the page is actually on screen.
  paintNextUp(state.nextUp);

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

  // One timer in this window, started when there is a clock and stopped when
  // there is not, so nothing runs a loop through a service.
  renderCountdown(state.countdownEndsAt);
  ticking?.();
  ticking = state.countdownEndsAt === null ? null : tickClocks();

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
  el.briefKeys.replaceChildren();
  for (const row of KEYS) {
    const term = document.createElement("dt");
    term.textContent = t(row.label);

    const detail = document.createElement("dd");
    detail.textContent = t(row.meaning);
    if (row.also !== undefined) {
      const also = document.createElement("span");
      also.className = "brief-also";
      also.textContent = t(row.also);
      detail.append(also);
    }

    el.briefKeys.append(term, detail);
  }
}

/**
 * The library, for the one thing the live surface may do with it (STG-49).
 *
 * Read off the editor state, which this window already receives since the two
 * halves share a document. Held here rather than put on the control state
 * because that goes down behind every keypress and this changes twice a year.
 */
let shelf: { id: string; title: string; subtitle: string | null }[] = [];

/**
 * The leader calls a song that is not in the set (STG-49, ST5.8).
 *
 * Opened on A, typed into, and the first match is on the deck on Enter. It
 * appends to the service that is running and writes nothing, so the set list a
 * church planned is still what they planned.
 */
function showCall(open: boolean): void {
  if (open === el.call.open) return;
  if (!open) {
    el.call.close();
    return;
  }
  // Nothing to add to. The deck is the service, and there is not one.
  if (latest?.service == null) return;
  el.callSearch.value = "";
  renderCall();
  el.call.showModal();
  el.callSearch.focus();
}

function callMatches(): typeof shelf {
  const query = el.callSearch.value.trim().toLowerCase();
  if (query === "") return shelf.slice(0, 20);
  return shelf
    .filter((row) => `${row.title} ${row.subtitle ?? ""}`.toLowerCase().includes(query))
    .slice(0, 20);
}

function renderCall(): void {
  const rows = callMatches();
  el.callEmpty.hidden = rows.length > 0;
  el.callList.replaceChildren();

  for (const [index, row] of rows.entries()) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "call-row";
    // The first match is what Enter takes, so it says so rather than leaving
    // the operator to guess which one a blind press lands on.
    if (index === 0) button.dataset["first"] = "true";

    const title = document.createElement("span");
    title.textContent = row.title;
    button.append(title);
    if (row.subtitle !== null && row.subtitle !== "") {
      const who = document.createElement("span");
      who.className = "quiet";
      who.textContent = row.subtitle;
      button.append(who);
    }

    button.addEventListener("click", () => addCalled(row));
    item.append(button);
    el.callList.append(item);
  }
}

function addCalled(row: { id: string; title: string }): void {
  send({ type: "addToDeck", itemId: row.id });
  showCall(false);
}

/** The card a volunteer reads at 10:28 (STG-27, ST12.10). */
function showBrief(open: boolean): void {
  if (open === el.brief.open) return;
  if (open) {
    el.brief.showModal();
    el.briefClose.focus();
  } else {
    el.brief.close();
  }
}

/**
 * The clock card (STG-26, ST5.10).
 *
 * Before one is running it offers lengths. While one is running it shows the
 * time left, offers more of it, because a service slips and the screen should
 * not be the thing that says so, and holds the one control that takes it down.
 */
function renderCountdown(endsAt: number | null): void {
  el.countdownLeft.hidden = endsAt === null;
  if (endsAt !== null) el.countdownLeft.dataset["endsAt"] = String(endsAt);

  el.countdownSet.replaceChildren();
  const choices: { label: string; run: () => void }[] =
    endsAt === null
      ? COUNTDOWNS.map((minutes) => ({
          label: t("countdown.minutes", { count: minutes }),
          run: () => send({ type: "startCountdown", minutes }),
        }))
      : [
          ...MORE.map((minutes) => ({
            label: t("countdown.add", { count: t("countdown.minutes", { count: minutes }) }),
            run: () => send({ type: "addCountdown", minutes }),
          })),
          { label: t("countdown.stop"), run: () => send({ type: "stopCountdown" }) },
        ];

  for (const choice of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = choice.label;
    button.addEventListener("click", choice.run);
    el.countdownSet.append(button);
  }
}

/** How long to put a clock up for, asked the same way (STG-26, ST5.10). */
function showCountdown(open: boolean): void {
  if (open === el.countdown.open) return;
  if (open) {
    el.countdown.showModal();
    el.countdownSet.querySelector("button")?.focus();
  } else {
    el.countdown.close();
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

  // Escape belongs to whatever card is open, because a person pressing it is
  // closing what is in front of them rather than uncovering a screen.
  if (el.call.open) {
    if (event.key === "Escape") {
      showCall(false);
      return;
    }
    if (event.key === "Enter") {
      // The first match, which is the one the card marks.
      event.preventDefault();
      const first = callMatches()[0];
      if (first !== undefined) addCalled(first);
      return;
    }
    // Everything else belongs to the search box, including the letters that
    // are keys out here.
    return;
  }
  if (el.brief.open || el.countdown.open) {
    if (event.key !== "Escape") return;
    showBrief(false);
    showCountdown(false);
    return;
  }

  const row = KEYS.find((candidate) => candidate.keys.includes(event.key));
  if (row === undefined) return;
  event.preventDefault();
  row.run();
}

// The workbench covering the landing page, or uncovering it (STG-48, STG-170).
new MutationObserver(() => focusNextUp()).observe(document.body, {
  attributes: true,
  attributeFilter: ["data-workbench"],
});

// The words, before anything paints over them (STG-13).
fillText();
for (const button of [el.briefClose, el.countdownClose, el.callClose]) button.append(icon("close"));
brief();

el.briefOpen.addEventListener("click", () => showBrief(true));
el.callOpen.addEventListener("click", () => showCall(true));
el.callClose.addEventListener("click", () => showCall(false));
el.callSearch.addEventListener("input", renderCall);
el.countdownOpen.addEventListener("click", () => showCountdown(true));
el.countdownClose.addEventListener("click", () => showCountdown(false));
renderCountdown(null);
el.briefClose.addEventListener("click", () => showBrief(false));
// The two ways in, and nothing else that reaches another window. Both open the
// other window, change nothing on the wall, and are safe to press (ST12.3).
el.wayPlans.addEventListener("click", () => send({ type: "showPlans" }));
el.wayLibrary.addEventListener("click", () => send({ type: "showLibrary" }));
el.waySettings.addEventListener("click", () => send({ type: "showSettings" }));
el.startNext.addEventListener("click", () => {
  const plan = latest?.nextUp;
  if (plan !== null && plan !== undefined) send({ type: "presentSetList", setListId: plan.id });
});
el.home.addEventListener("click", () => send({ type: "closeService" }));
el.resetRun.addEventListener("click", () => send({ type: "resetRun" }));
window.addEventListener("keydown", onKey);

if (bridge !== undefined) {
  bridge.onControlState(paint);
  // The library, for the one thing the live surface may do with it (STG-49).
  bridge.onEditorState((state) => {
    shelf = state.library
      .filter((row) => row.kind === "song")
      .map((row) => ({ id: row.id, title: row.title, subtitle: row.subtitle }));
    if (el.call.open) renderCall();
  });
  bridge.onLogo((mark) => {
    logo = mark;
    if (latest !== null) paint(latest);
  });
  void bridge.hello().then((state) => {
    if (state.control !== null) paint(state.control);
  });
}
