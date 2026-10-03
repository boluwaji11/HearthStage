/**
 * STG-28, ST6.4, ST20.4. The render harness.
 *
 * Not a screen. It is the output renderer, loaded at a size a test names, so
 * the geometry a church sees can be asserted rather than reasoned about. Every
 * slide of the bundled library, in every theme, at three output resolutions.
 *
 * It measures three things:
 *
 * **Where the glyphs are.** The painted box of the text against the theme's
 * safe area. A descender crossing that line is clipped on a projector with
 * overscan, and nobody finds out until a Sunday.
 *
 * **How tall a capital is.** ST20.4 sets the floor at 4% of output height, and
 * it says cap height, which is not the font size. Measured off a canvas with
 * the theme's own font, because the ratio differs by typeface.
 *
 * **Whether anything overflows.** A slide taller than the screen is a slide
 * with a line nobody in the room can read.
 *
 * It imports the same module the output window does, so a harness that passes
 * is a statement about the product rather than about the harness.
 */

import { bundledHymns, compileDeck, lookupFrom, songPlan } from "@hearth/songs";
import type { OutputContent, ThemeState } from "@hearth/stage-protocol";
import { contentOf } from "../main/session";
import { BUILT_IN_THEMES } from "../main/themes";
import { FitCache, safeBox } from "../output/fit";
import { applyTheme, createRuler, measureWith, renderSlide, sizeFor } from "../output/slide";

export interface RenderCase {
  content: OutputContent;
  theme: ThemeState;
  width: number;
  height: number;
}

export interface Measured {
  /** The size the output window would paint this at. */
  textSizePx: number;
  /** A capital's height, in pixels, measured in the theme's own font. */
  capHeightPx: number;
  /** The painted text, as a box inside the output. */
  text: { top: number; left: number; right: number; bottom: number };
  /** The safe area, as the same kind of box. */
  safe: { top: number; left: number; right: number; bottom: number };
  /** True where the slide is taller or wider than the screen it is on. */
  overflows: boolean;
}

const stage = document.getElementById("stage") as HTMLDivElement;
const cache = new FitCache();
const ruler = createRuler();
const canvas = document.createElement("canvas");

/**
 * The height of a capital letter, in the theme's own font.
 *
 * `actualBoundingBoxAscent` of an `H` is the cap height by definition, and it
 * is the number ST20.4 sets a floor under. A ratio taken off the font size
 * would be a guess that differs by typeface.
 */
function capHeight(theme: ThemeState, sizePx: number): number {
  const context = canvas.getContext("2d");
  if (context === null) return 0;
  context.font = `${theme.fontWeight} ${sizePx}px ${theme.fontFamily}`;
  return context.measureText("H").actualBoundingBoxAscent;
}

export function measure(entry: RenderCase): Measured {
  stage.style.width = `${entry.width}px`;
  stage.style.height = `${entry.height}px`;
  stage.replaceChildren();

  applyTheme(stage, entry.theme);
  const measured = sizeFor(
    entry.content,
    entry.theme,
    { width: entry.width, height: entry.height },
    cache,
    ruler,
  );
  const sizePx = measured ?? entry.theme.textSize * entry.height;
  stage.style.setProperty("--text-size", `${sizePx}px`);

  const slide = renderSlide(entry.content);
  stage.append(slide);

  const outer = stage.getBoundingClientRect();
  const lines = slide.querySelector(".lines") ?? slide.firstElementChild ?? slide;
  const painted = lines.getBoundingClientRect();
  const within = safeBox({ width: entry.width, height: entry.height }, entry.theme.safeArea);
  const inset = (entry.width - within.width) / 2;
  const insetY = (entry.height - within.height) / 2;

  return {
    textSizePx: sizePx,
    capHeightPx: capHeight(entry.theme, sizePx),
    text: {
      top: painted.top - outer.top,
      left: painted.left - outer.left,
      right: painted.right - outer.left,
      bottom: painted.bottom - outer.top,
    },
    safe: {
      top: insetY,
      left: inset,
      right: entry.width - inset,
      bottom: entry.height - insetY,
    },
    overflows: slide.scrollHeight > entry.height + 1 || slide.scrollWidth > entry.width + 1,
  };
}

/** The three a church actually presents on. */
export const RESOLUTIONS = [
  { name: "720p", width: 1280, height: 720 },
  { name: "1080p", width: 1920, height: 1080 },
  { name: "4K", width: 3840, height: 2160 },
];

export interface Failure {
  what: string;
  item: string;
  theme: string;
  resolution: string;
  detail: string;
}

export interface Report {
  cases: number;
  failures: Failure[];
}

/** ST20.4: a capital at or above this much of the output's height. */
const CAP_FLOOR = 0.04;

/**
 * Every slide of the bundled library, in every theme, at three resolutions.
 *
 * Built in here rather than handed in, because the cases are the product's own
 * records and a harness fed a fixture it made up is a harness testing itself.
 */
function cases(): { content: OutputContent; item: string }[] {
  const built: { content: OutputContent; item: string }[] = [];
  for (const whole of bundledHymns()) {
    const deck = compileDeck(songPlan(whole, { date: "2026-10-04" }), lookupFrom([whole]));
    for (const cue of deck.cues) {
      built.push({ content: contentOf(cue, deck), item: `${whole.song.title} ${cue.label ?? ""}` });
    }
  }
  return built;
}

export function run(limit = Number.POSITIVE_INFINITY): Report {
  const failures: Failure[] = [];
  let counted = 0;

  const slides = cases().slice(0, limit);
  for (const { theme, name } of BUILT_IN_THEMES.map((entry) => ({
    theme: entry.theme,
    name: entry.theme.id,
  }))) {
    for (const size of RESOLUTIONS) {
      for (const slide of slides) {
        counted += 1;
        const measured = measure({
          content: slide.content,
          theme,
          width: size.width,
          height: size.height,
        });

        const where = { item: slide.item, theme: name, resolution: size.name };
        const { text, safe } = measured;

        // ST6.4: no glyph crosses the safe area. Half a pixel of slack,
        // because a box measured in CSS pixels lands on a fraction.
        if (
          text.top < safe.top - 0.5 ||
          text.left < safe.left - 0.5 ||
          text.right > safe.right + 0.5 ||
          text.bottom > safe.bottom + 0.5
        ) {
          failures.push({
            ...where,
            what: "safe area",
            detail: `text ${box(text)} outside ${box(safe)}`,
          });
        }

        if (measured.overflows) {
          failures.push({ ...where, what: "overflow", detail: "the slide is taller than the screen" });
        }

        // ST20.4: cap height, which is not the font size.
        const floor = CAP_FLOOR * size.height;
        if (measured.capHeightPx < floor - 0.5) {
          failures.push({
            ...where,
            what: "cap height",
            detail: `${measured.capHeightPx.toFixed(1)}px, floor ${floor.toFixed(1)}px`,
          });
        }
      }
    }
  }

  return { cases: counted, failures };
}

function box(at: { top: number; left: number; right: number; bottom: number }): string {
  return `[${at.left.toFixed(0)}, ${at.top.toFixed(0)}, ${at.right.toFixed(0)}, ${at.bottom.toFixed(0)}]`;
}

declare global {
  interface Window {
    harness: { measure: (entry: RenderCase) => Measured; run: (limit?: number) => Report };
  }
}

window.harness = { measure, run };
void measureWith;
