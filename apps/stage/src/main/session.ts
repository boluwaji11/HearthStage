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
  type ThemeState,
} from "@hearth/stage-protocol";
import type { Cue, Deck, ServicePlan } from "@hearth/songs";

/**
 * The built-in theme, good enough to use unmodified during a service (ST8.1).
 *
 * Sizes are a fraction of output height, so the same theme is right on a 1080p
 * projector and on a 4K foyer screen. `textSize` is cap height at 0.072, which
 * clears the 0.04 legibility floor in ST20.4 with room to spare, because the
 * floor is a floor rather than a target.
 */
export const DEFAULT_THEME: ThemeState = {
  id: "hearth-default",
  fontFamily:
    '"Source Serif 4", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  fontWeight: 500,
  textSize: 0.072,
  lineHeight: 1.28,
  colour: "oklch(0.985 0.003 75)",
  background: "oklch(0.142 0.008 75)",
  textAlign: "center",
  verticalAlign: "middle",
  safeArea: 0.075,
  transitionMs: 200,
  textShadow: "0 0.08em 0.3em oklch(0 0 0 / 0.55)",
};

export interface SessionOptions {
  theme?: ThemeState;
}

export class Session {
  private deck: Deck;
  private plan: ServicePlan | null;
  private theme: ThemeState;
  private position = 0;
  private blank: Blank = "none";
  private revision = 0;

  constructor(deck: Deck, plan: ServicePlan | null = null, options: SessionOptions = {}) {
    this.deck = deck;
    this.plan = plan;
    this.theme = options.theme ?? DEFAULT_THEME;
  }

  /**
   * Opens a different service.
   *
   * The cue id is kept where the new deck still has it, so a recompile after a
   * plan change lands on the same slide rather than back at the beginning
   * (ST5.11).
   */
  open(deck: Deck, plan: ServicePlan | null = null): void {
    const liveId = this.deck.cues[this.position]?.id;
    this.deck = deck;
    this.plan = plan;
    const found = liveId === undefined ? -1 : deck.cues.findIndex((cue) => cue.id === liveId);
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
        return this.moveTo(this.position + 1);
      case "reverse":
        return this.moveTo(this.position - 1);
      case "goTo":
        return this.moveTo(intent.position);
      case "goToCue": {
        const found = this.deck.cues.findIndex((cue) => cue.id === intent.cueId);
        return found === -1 ? false : this.moveTo(found);
      }
      case "setBlank":
        return this.setBlank(intent.blank);
      case "toggleBlank":
        // Pressing black twice comes back to the slide, which is how an
        // operator uses it (ST6.6).
        return this.setBlank(this.blank === intent.blank ? "none" : intent.blank);
      case "reload":
        this.revision += 1;
        return true;
    }
  }

  private moveTo(position: number): boolean {
    if (this.deck.cues.length === 0) return false;
    const clamped = Math.min(Math.max(position, 0), this.deck.cues.length - 1);
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
    return this.deck.cues[this.position]?.id ?? null;
  }

  /** Puts a session back where it was, by cue id rather than by position. */
  restoreTo(cueId: string): boolean {
    return this.apply({ type: "goToCue", cueId });
  }

  outputState(outputId: string): OutputState {
    return {
      outputId,
      revision: this.revision,
      blank: this.blank,
      content: contentOf(this.deck.cues[this.position] ?? null, this.deck),
      theme: this.theme,
    };
  }

  controlState(outputs: OutputView[]): ControlState {
    return {
      revision: this.revision,
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
          cueIds: group.cues.map((cue) => cue.id),
        }),
      ),
      cues: this.deck.cues.map(
        (cue): CueView => ({
          id: cue.id,
          position: cue.position,
          groupId: cue.groupId,
          kind: cue.kind,
          label: cue.label,
          occurrence: cue.occurrence,
          occurrencesTotal: cue.occurrencesTotal,
          slideIndex: cue.slideIndex,
          slideCount: cue.slideCount,
          preview: cue.lines?.[0] ?? null,
        }),
      ),
      position: this.position,
      blank: this.blank,
      outputs,
      problems: this.deck.problems.map((problem) => ({
        code: problem.code,
        detail: "title" in problem ? problem.title : "",
      })),
    };
  }
}

/**
 * Every slide of the section a cue belongs to.
 *
 * Sent down with the cue so the renderer can share one text size across the
 * whole section (ST6.2). A section is identified by its group, its label and
 * which repeat it is, because the second chorus is a different section's worth
 * of slides from the first even though the words match.
 */
function sectionSlides(cue: Cue, deck: Deck): { slides: string[][]; key: string } {
  const siblings = deck.cues
    .filter(
      (candidate) =>
        candidate.groupId === cue.groupId &&
        candidate.label === cue.label &&
        candidate.occurrence === cue.occurrence &&
        candidate.kind === "lyric",
    )
    .sort((left, right) => left.slideIndex - right.slideIndex);

  return {
    slides: siblings.map((sibling) => sibling.lines ?? []),
    key: `${cue.groupId}:${cue.label ?? ""}:${cue.occurrence}`,
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
    deck === undefined
      ? { slides: [cue.lines ?? []], key: cue.id }
      : sectionSlides(cue, deck);

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
