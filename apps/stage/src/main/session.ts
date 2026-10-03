/**
 * STG-11, STG-12. The live state of a service, and the only thing that holds it.
 *
 * Main owns all state. Every window is a function of state it is handed, so a
 * renderer never decides what is live. This class is that state, and it is
 * deliberately free of Electron: it takes intents, it returns the state each
 * window should paint, and it can be tested without opening a window.
 *
 * It is also what makes crash recovery cheap. A restored session is state
 * applied to fresh renderers rather than a sequence of events replayed, which
 * is why five seconds is achievable (ST19.1).
 */

import {
  type Blank,
  type ControlState,
  type CueView,
  type GroupView,
  type Intent,
  type OutputContent,
  type OutputState,
  type OutputView,
  type SlideView,
  type ThemeState,
} from "@hearth/stage-protocol";
import type { Cue, CueGroup, Deck, ServicePlan } from "@hearth/songs";
import { DEFAULT_THEME, themeFor } from "./themes";
import { applyChange, asPlanned, runFrom, type RunEntry } from "./running";

export { DEFAULT_THEME };

export interface SessionOptions {
  /** The service's theme, used by anything that does not name its own. */
  theme?: ThemeState;
  /**
   * How to find a theme a presentation names (STG-148).
   *
   * Passed in so the session stays free of the built-in list and a test can
   * hand it two themes it made up.
   */
  themes?: (themeId: string | null) => ThemeState;
  /**
   * The clock the repeat guard reads (STG-23, ST12.4).
   *
   * Passed in so a test can hold time still and send a burst, rather than
   * sleeping and hoping.
   */
  now?: () => number;
}

/**
 * Closer together than a person presses twice (STG-23, ST12.4).
 *
 * A key auto-repeating fires every thirty milliseconds or so once it starts,
 * and a presentation clicker with a tired switch sends two in a handful. A
 * second press from a person is nowhere near this fast, and an operator who
 * genuinely needs two cues in sixty milliseconds is an operator holding the
 * key down, which is the thing this exists to catch.
 */
export const REPEAT_GUARD_MS = 60;

export class Session {
  private deck: Deck;
  private plan: ServicePlan | null;
  private theme: ThemeState;
  private readonly themes: (themeId: string | null) => ThemeState;
  private position = 0;
  private blank: Blank = "none";
  private revision = 0;
  private readonly now: () => number;
  /** The order this run goes in (STG-24). Built from the deck, never into it. */
  private order: RunEntry[];
  /**
   * When the countdown reaches zero (STG-26, ST5.10).
   *
   * A moment rather than a number of seconds, so the windows count for
   * themselves and a clock on the wall is one message rather than one a second
   * through the render path.
   */
  private countdownEndsAt: number | null = null;
  /** When the deck last moved on a key, for the repeat guard (STG-23). */
  private movedAt = Number.NEGATIVE_INFINITY;

  constructor(deck: Deck, plan: ServicePlan | null = null, options: SessionOptions = {}) {
    this.deck = deck;
    this.plan = plan;
    this.theme = options.theme ?? DEFAULT_THEME;
    this.themes = options.themes ?? themeFor;
    this.now = options.now ?? Date.now;
    this.order = runFrom(deck);
  }

  /** The cue an entry in the running order stands for. */
  private cueAt(position: number): Cue | undefined {
    const entry = this.order[position];
    if (entry === undefined) return undefined;
    return this.deck.cues.find((cue) => cue.id === entry.cueId);
  }

  /**
   * The next entry the room will actually see, from a position.
   *
   * A skipped entry stays in the list so the operator can see what they took
   * out and put it back, so moving through the service steps over them.
   */
  private showingFrom(position: number, direction: 1 | -1): number {
    for (let at = position; at >= 0 && at < this.order.length; at += direction) {
      if (this.order[at]?.skipped === false) return at;
    }
    return -1;
  }

  /**
   * Opens a different service.
   *
   * The cue id is kept where the new deck still has it, so a recompile after a
   * plan change lands on the same slide rather than back at the beginning
   * (ST5.11).
   */
  open(deck: Deck, plan: ServicePlan | null = null): void {
    const liveId = this.cueAt(this.position)?.id;
    this.deck = deck;
    this.plan = plan;
    // A new deck is a new service, so the run starts as the church planned it.
    // Carrying a skipped verse across a recompile would hide a verse somebody
    // has just put back into the set list.
    this.order = runFrom(deck);
    const found =
      liveId === undefined ? -1 : this.order.findIndex((entry) => entry.cueId === liveId);
    this.position = found === -1 ? 0 : found;
    this.revision += 1;
  }

  /**
   * Applies an intent, and says whether anything changed.
   *
   * Returning false matters: an advance at the end of the deck should not bump
   * the revision, because a revision bump is a repaint on every output.
   */
  apply(intent: Intent): boolean {
    switch (intent.type) {
      case "advance":
        return this.step(1);
      case "reverse":
        return this.step(-1);
      case "goTo":
        return this.moveTo(intent.position);
      case "goToCue": {
        const found = this.order.findIndex(
          (entry) => !entry.skipped && (entry.id === intent.cueId || entry.cueId === intent.cueId),
        );
        return found === -1 ? false : this.moveTo(found);
      }
      case "runChange":
        return this.changeRun(intent.entryId, intent.change);
      case "resetRun": {
        if (asPlanned(this.order, this.deck)) return false;
        const liveId = this.cueAt(this.position)?.id;
        this.order = runFrom(this.deck);
        this.position = Math.max(
          0,
          this.order.findIndex((entry) => entry.cueId === liveId),
        );
        this.revision += 1;
        return true;
      }
      case "startCountdown": {
        // Over whatever is open, including nothing at all, which is the point
        // of it: a church puts a clock up before the service has a deck.
        this.countdownEndsAt = this.now() + intent.minutes * 60_000;
        this.revision += 1;
        return true;
      }
      case "addCountdown": {
        // Only onto a clock that is running. Adding five minutes to nothing is
        // a button that looks like it worked and did not.
        if (this.countdownEndsAt === null) return false;
        this.countdownEndsAt += intent.minutes * 60_000;
        this.revision += 1;
        return true;
      }
      case "stopCountdown":
        if (this.countdownEndsAt === null) return false;
        this.countdownEndsAt = null;
        this.revision += 1;
        return true;
      case "setBlank":
        return this.setBlank(intent.blank);
      case "toggleBlank":
        // Pressing black twice comes back to the slide, which is how an
        // operator uses it (ST6.6).
        return this.setBlank(this.blank === intent.blank ? "none" : intent.blank);
      case "reload":
        this.revision += 1;
        return true;
      default:
        // The editor's intents belong to `Presentations`. The session holds
        // what is live, and an intent it does not own changes nothing here.
        return false;
    }
  }

  /**
   * One cue, on a key (STG-23, ST12.4).
   *
   * Held down, a key repeats, and four cues go past before anybody's finger
   * comes off it. The window ignores the repeat flag the operating system sets,
   * and this is the second half: a clicker that bounces, or a remote that sends
   * its own bursts, does not set that flag and still has to move one cue.
   *
   * Jumping to a cue by name or by clicking it is not guarded. Those are a
   * person choosing, one at a time, and there is no such thing as a repeat.
   */
  /**
   * One change to the running order (STG-24, ST5.7).
   *
   * The live entry is held by its own identity across the change, so skipping
   * the verse after this one does not move the room, and skipping the one that
   * is live moves on to the next thing that will be shown.
   */
  private changeRun(entryId: string, change: "skip" | "repeat" | "up" | "down" | "drop"): boolean {
    const liveEntry = this.order[this.position]?.id ?? null;
    const changed = applyChange(this.order, entryId, change);
    if (changed === null) return false;

    this.order = changed;
    const found = changed.findIndex((entry) => entry.id === liveEntry);
    const at = found === -1 ? this.position : found;
    // Where the operator skipped what was live, the room moves on to the next
    // thing rather than sitting on a slide that is no longer in the service.
    const showing = changed[at]?.skipped === true ? this.showingFrom(at, 1) : at;
    this.position = showing === -1 ? Math.max(0, this.showingFrom(at, -1)) : showing;
    this.revision += 1;
    return true;
  }

  private step(direction: 1 | -1): boolean {
    const at = this.now();
    const stillDown = at - this.movedAt < REPEAT_GUARD_MS;
    // Stamped on every press, including the ones it refuses. Stamping only the
    // ones that moved would turn this into a rate limit, and a key held for two
    // seconds would walk the deck at one cue every sixty milliseconds instead
    // of moving one cue.
    this.movedAt = at;
    if (stillDown) return false;
    const next = this.showingFrom(this.position + direction, direction);
    return next === -1 ? false : this.moveTo(next);
  }

  private moveTo(position: number): boolean {
    if (this.order.length === 0) return false;
    const clamped = Math.min(Math.max(position, 0), this.order.length - 1);
    // A skipped entry is not somewhere the service goes. The operator puts it
    // back first, which is one press and visible in the list.
    if (this.order[clamped]?.skipped === true) return false;
    if (clamped === this.position) return false;
    this.position = clamped;
    this.revision += 1;
    return true;
  }

  private setBlank(blank: Blank): boolean {
    if (blank === this.blank) return false;
    this.blank = blank;
    this.revision += 1;
    return true;
  }

  /** The live cue's id, which is what gets persisted for recovery (ST19.2). */
  liveCueId(): string | null {
    return this.cueAt(this.position)?.id ?? null;
  }

  /** Puts a session back where it was, by cue id rather than by position. */
  restoreTo(cueId: string): boolean {
    return this.apply({ type: "goToCue", cueId });
  }

  /**
   * The theme the live cue should be painted in (STG-148, ST8.1).
   *
   * A presentation can name its own, and anything that does not takes the
   * service's. The look is resolved here rather than stored on the cue, so
   * changing a theme is a different act from touching the words: a recompile is
   * never needed and a slide is never rewritten to restyle it.
   */
  private liveTheme(): ThemeState {
    return this.themeAt(this.position);
  }

  private themeAt(position: number): ThemeState {
    const cue = position < 0 ? undefined : this.cueAt(position);
    if (cue === undefined) return this.theme;
    const group: CueGroup | undefined = this.deck.groups.find(
      (candidate) => candidate.id === cue.groupId,
    );
    if (group?.themeId == null) return this.theme;
    return this.themes(group.themeId);
  }

  /** One cue, as the control surface paints it in its live and next panes. */
  private slideView(position: number): SlideView | null {
    const cue = position < 0 ? undefined : this.cueAt(position);
    if (cue === undefined) return null;
    return { content: contentOf(cue, this.deck), theme: this.themeAt(position) };
  }

  /** What the live pane shows, which is the clock where one is running. */
  private liveView(): SlideView | null {
    const clock = this.countdown();
    if (clock !== null) return { content: clock, theme: this.themeAt(this.position) };
    return this.slideView(this.position);
  }

  /** The clock, where one is running, over whatever else is live. */
  private countdown(): OutputContent | null {
    if (this.countdownEndsAt === null) return null;
    return { kind: "countdown", endsAt: this.countdownEndsAt, message: null };
  }

  outputState(outputId: string): OutputState {
    return {
      outputId,
      revision: this.revision,
      blank: this.blank,
      content: this.countdown() ?? contentOf(this.cueAt(this.position) ?? null, this.deck),
      theme: this.liveTheme(),
    };
  }

  /**
   * `nextUp` is handed in rather than read here, because the session owns the
   * deck on the screen and the plans live in the library (STG-48).
   */
  controlState(outputs: OutputView[], nextUp: ControlState["nextUp"] = null): ControlState {
    return {
      revision: this.revision,
      live: this.liveView(),
      next: this.slideView(this.showingFrom(this.position + 1, 1)),
      service:
        this.plan === null
          ? null
          : {
              id: this.plan.id,
              title: this.plan.title,
              date: this.plan.date,
              source: this.plan.source,
            },
      groups: this.deck.groups.map(
        (group): GroupView => ({
          id: group.id,
          title: group.title,
          kind: group.kind,
          key: group.key,
          tempoBpm: group.tempoBpm,
          sequence: group.sequence,
          notes: group.notes,
          // In the order this run will show them, which is where a moved verse
          // and a repeated chorus turn up.
          entryIds: this.order
            .filter((entry) => entry.groupId === group.id)
            .map((entry) => entry.id),
        }),
      ),
      cues: this.order.flatMap((entry, position): CueView[] => {
        const cue = this.deck.cues.find((candidate) => candidate.id === entry.cueId);
        if (cue === undefined) return [];
        return [{
          id: cue.id,
          entryId: entry.id,
          skipped: entry.skipped,
          repeat: entry.repeat,
          position,
          groupId: cue.groupId,
          kind: cue.kind,
          label: cue.label,
          occurrence: cue.occurrence,
          occurrencesTotal: cue.occurrencesTotal,
          slideIndex: cue.slideIndex,
          slideCount: cue.slideCount,
          preview: cue.lines?.[0] ?? null,
          note: cue.note,
        }];
      }),
      position: this.position,
      blank: this.blank,
      outputs,
      asPlanned: asPlanned(this.order, this.deck),
      countdownEndsAt: this.countdownEndsAt,
      nextUp,
      problems: this.deck.problems.map((problem) => ({
        code: problem.code,
        // What the item is called, which is the only part of a compile problem
        // an operator can act on. A scripture item that failed has a reference
        // rather than a title.
        detail:
          "title" in problem
            ? problem.title
            : "reference" in problem
              ? problem.reference
              : "",
      })),
    };
  }
}

/**
 * Every slide that shares one measured text size with this cue.
 *
 * Sent down with the cue so the renderer can hold one size across the whole
 * group (ST6.2), and the grouping is named by the compiler rather than guessed
 * at here. For a song that group is a section, so the words do not jump between
 * the two halves of a chorus. For slides a person typed it is one typed slide,
 * so a title card is not shrunk to fit the outline that follows it.
 */
function fitSlides(cue: Cue, deck: Deck): { slides: string[][]; key: string } {
  const siblings = deck.cues
    .filter((candidate) => candidate.fitGroup === cue.fitGroup)
    .sort((left, right) => left.slideIndex - right.slideIndex);

  return {
    slides: siblings.map((sibling) => sibling.lines ?? []),
    key: cue.fitGroup,
  };
}

/** A cue, as the thing an output paints. */
export function contentOf(cue: Cue | null, deck?: Deck): OutputContent {
  if (cue === null) return { kind: "nothing" };

  if (cue.kind === "marker") return { kind: "nothing" };

  if (cue.kind === "scripture") {
    return {
      kind: "scripture",
      lines: cue.lines ?? [],
      reference: cue.reference ?? "",
    };
  }

  const section =
    deck === undefined ? { slides: [cue.lines ?? []], key: cue.fitGroup } : fitSlides(cue, deck);

  if (cue.kind === "slide") {
    return {
      kind: "slide",
      lines: cue.lines ?? [],
      label: cue.label,
      slideIndex: cue.slideIndex,
      slideCount: cue.slideCount,
      fitSlides: section.slides,
      fitKey: section.key,
    };
  }

  return {
    kind: "lyric",
    lines: cue.lines ?? [],
    translation: null,
    label: cue.label,
    occurrence: cue.occurrence,
    occurrencesTotal: cue.occurrencesTotal,
    slideIndex: cue.slideIndex,
    slideCount: cue.slideCount,
    fitSlides: section.slides,
    fitKey: section.key,
  };
}
