/**
 * STG-145, ST2.16, ST2.19.
 *
 * A presentation: an ordered set of slides, and the central object of the
 * product.
 *
 * The first version of this package could hold a song and nothing else, and a
 * model that can only hold songs can present roughly a third of a service. The
 * title card, the three notices, the sermon outline, the bulletin page and the
 * memorial slide are all the same thing: somebody typed words and wants them on
 * the wall. That thing is a presentation, and a song is one kind of it.
 *
 * Two decisions here are load bearing.
 *
 * 1. **The author's break is the break.** A song is broken into slides by rule,
 *    because a church types lyrics as sections and the typography decides what
 *    fits. A presentation is broken where the person pressed return twice. They
 *    are looking at the sermon outline and they know where the point ends. The
 *    line limit still applies, so a slide typed too long for the screen splits
 *    further rather than running off the bottom.
 * 2. **A slide carries a label and a note, and neither reaches the wall.** The
 *    label is what the operator sees in the deck list, so "Point 2" can be
 *    found during the sermon. The note is for whoever built the slide (ST2.19).
 */

import { DEFAULT_LIMITS, splitLines, type SlideLimits } from "./slides";
import type { PresentationItem, ServicePlan } from "./service";
import type { SongOrigin } from "./types";

/**
 * What a presentation holds.
 *
 * `plain` is slides somebody typed. The other three are the same list seen from
 * the library, which is what STG-146 wires up: a song's slides come from its
 * arrangement, a reading's from a passage, a media item's from a file.
 */
export const PRESENTATION_KINDS = ["plain", "song", "reading", "media"] as const;

export type PresentationKind = (typeof PRESENTATION_KINDS)[number];

export interface PresentationSlide {
  id: string;
  presentationId: string;
  sortOrder: number;
  /** "Point 2". Shown to the operator and kept off the wall (ST6.3). */
  label: string | null;
  /** The words. One line per element, and a line never holds a newline. */
  lines: string[];
  /** For whoever built the slide. Never presented (ST2.19). */
  notes: string | null;
}

export interface Presentation {
  id: string;
  /** Who may write it. A `hearth` presentation is read-only on the laptop. */
  origin: SongOrigin;
  kind: PresentationKind;
  title: string;
  slides: PresentationSlide[];
  /** null takes whatever theme the service is using (ST8.1). */
  themeId: string | null;
  /** RFC 3339. Maintained from usage rather than typed. */
  lastUsedAt: string | null;
}

/** An empty presentation, which is what a person starts from. */
export function newPresentation(
  id: string,
  options: { title?: string; kind?: PresentationKind } = {},
): Presentation {
  return {
    id,
    origin: "local",
    kind: options.kind ?? "plain",
    title: options.title ?? "",
    slides: [],
    themeId: null,
    lastUsedAt: null,
  };
}

/** A label written on its own line, in brackets, as the editor accepts it. */
const LABEL_LINE = /^\[([^\]]{1,32})\]$/;

export interface ParseOptions {
  presentationId: string;
  /** Overridden in a test so slide ids are stable. */
  slideId?: (index: number) => string;
}

/**
 * Slides from typed text.
 *
 * One box, a blank line between slides, and that is the whole input language.
 * It is how a person already writes an outline, it survives a paste out of a
 * sermon document, and it needs nothing explained on screen.
 *
 * A slide whose first line is `[Point 2]` takes that as its label and does not
 * show it. Trailing blank lines are dropped, and a run of several blank lines
 * is one break rather than an empty slide, because nobody means a blank slide
 * by pressing return four times.
 */
export function parseSlides(text: string, options: ParseOptions): PresentationSlide[] {
  const id = options.slideId ?? ((index: number) => `${options.presentationId}:slide:${index + 1}`);

  const blocks: string[][] = [];
  let current: string[] = [];
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim() === "") {
      if (current.length > 0) blocks.push(current);
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current);

  return blocks.map((block, index) => {
    const head = block[0] ?? "";
    const match = LABEL_LINE.exec(head.trim());
    const lines = match === null ? block : block.slice(1);
    return {
      id: id(index),
      presentationId: options.presentationId,
      sortOrder: index,
      label: match === null ? null : (match[1] as string).trim(),
      lines,
      notes: null,
    };
  });
}

/**
 * The text a person typed, back from the slides.
 *
 * The editor loads a saved presentation into the same box it was typed in, so
 * this has to be the exact inverse of `parseSlides` for anything it produced.
 * A test holds that round trip.
 */
export function formatSlides(slides: PresentationSlide[]): string {
  return [...slides]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((slide) => (slide.label === null ? slide.lines : [`[${slide.label}]`, ...slide.lines]))
    .map((lines) => lines.join("\n"))
    .join("\n\n");
}

export type PresentationProblem =
  | { code: "title.missing"; severity: "error" }
  | { code: "kind.unknown"; severity: "error"; value: string }
  | { code: "slides.none"; severity: "error" }
  | { code: "slide.lines.empty"; severity: "error"; sortOrder: number }
  | { code: "slide.lines.containsNewline"; severity: "error"; sortOrder: number; line: number }
  | { code: "slide.presentation.mismatch"; severity: "error"; slideId: string }
  | { code: "slide.sortOrder.duplicate"; severity: "warning"; sortOrder: number }
  | { code: "slide.label.long"; severity: "warning"; sortOrder: number; length: number };

export type PresentationProblemCode = PresentationProblem["code"];

/** A label longer than this stops being a label and starts being a sentence. */
const LABEL_LIMIT = 32;

const KINDS = new Set<string>(PRESENTATION_KINDS);

/**
 * Everything wrong with a presentation, in the order it was found.
 *
 * Same contract as `validateWholeSong`: data rather than sentences, the whole
 * object rather than the first fault, and the store runs it on every write so
 * the newline guard cannot be skipped by a caller in a hurry.
 */
export function validatePresentation(presentation: Presentation): PresentationProblem[] {
  const problems: PresentationProblem[] = [];

  if (presentation.title.trim() === "") {
    problems.push({ code: "title.missing", severity: "error" });
  }
  if (!KINDS.has(presentation.kind)) {
    problems.push({ code: "kind.unknown", severity: "error", value: presentation.kind });
  }
  if (presentation.slides.length === 0) {
    problems.push({ code: "slides.none", severity: "error" });
  }

  const seen = new Set<number>();
  for (const slide of presentation.slides) {
    if (slide.presentationId !== presentation.id) {
      problems.push({
        code: "slide.presentation.mismatch",
        severity: "error",
        slideId: slide.id,
      });
    }
    if (seen.has(slide.sortOrder)) {
      problems.push({
        code: "slide.sortOrder.duplicate",
        severity: "warning",
        sortOrder: slide.sortOrder,
      });
    }
    seen.add(slide.sortOrder);

    if (slide.lines.filter((line) => line.trim() !== "").length === 0) {
      problems.push({ code: "slide.lines.empty", severity: "error", sortOrder: slide.sortOrder });
    }
    slide.lines.forEach((line, index) => {
      if (line.includes("\n")) {
        problems.push({
          code: "slide.lines.containsNewline",
          severity: "error",
          sortOrder: slide.sortOrder,
          line: index,
        });
      }
    });

    if (slide.label !== null && slide.label.length > LABEL_LIMIT) {
      problems.push({
        code: "slide.label.long",
        severity: "warning",
        sortOrder: slide.sortOrder,
        length: slide.label.length,
      });
    }
  }

  return problems;
}

export function presentationHasErrors(problems: PresentationProblem[]): boolean {
  return problems.some((problem) => problem.severity === "error");
}

/** Slides in presented order, whatever order they were stored in. */
export function orderedSlides(presentation: Presentation): PresentationSlide[] {
  return [...presentation.slides].sort((left, right) => left.sortOrder - right.sortOrder);
}

/**
 * How many slides a presentation puts on the wall.
 *
 * Not the same as the number the author typed. A slide longer than the theme's
 * line limit becomes two, and the number an editor shows has to be the number
 * the room will see.
 */
export function slideCount(
  presentation: Presentation,
  limits: SlideLimits = DEFAULT_LIMITS,
): number {
  return orderedSlides(presentation).reduce(
    (total, slide) => total + Math.max(1, splitLines(slide.lines, limits).length),
    0,
  );
}

/**
 * A presentation on its own, as a service.
 *
 * Presenting one thing immediately is the common case outside a service: the
 * notices on a Tuesday evening while they are being written, a memorial slide
 * put up during a prayer. The deck compiler takes a plan, so this makes the
 * smallest honest one rather than adding a second path into the compiler.
 */
export function presentationPlan(
  presentation: Presentation,
  options: { date?: string } = {},
): ServicePlan {
  const item: PresentationItem = {
    type: "presentation",
    id: `item:${presentation.id}`,
    sortOrder: 0,
    title: presentation.title,
    durationSeconds: null,
    notes: [],
    presentationId: presentation.id,
  };

  return {
    id: `plan:${presentation.id}`,
    source: "set_list",
    title: presentation.title,
    date: options.date ?? new Date().toISOString().slice(0, 10),
    startsAt: null,
    items: [item],
  };
}
