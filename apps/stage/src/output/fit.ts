/**
 * STG-18, ST6.2.
 *
 * How large the words can be.
 *
 * Two rules, and the second one is the reason this is harder than it looks:
 *
 * 1. **Text fits the safe area by measurement.** Not by a guess at how many
 *    characters fit, which is wrong the moment a theme changes font.
 * 2. **Every slide in a section shares one size.** A section split across two
 *    slides where the first is short and the second is long must not jump size
 *    between them, because a congregation reads the jump as a mistake.
 *
 * Rule 2 is why the measurement cannot be done from one slide. The renderer is
 * handed every slide of the section it is painting, finds the largest size each
 * one could take, and uses the smallest of those. The result is cached, because
 * measuring is layout and layout has no business in the path between a keypress
 * and a pixel (ST21.1).
 *
 * The search itself is pure and takes a measuring function, so it is tested
 * against a known model of text rather than against a browser.
 */

export interface Box {
  width: number;
  height: number;
}

/** Measures a group of lines at a font size, in pixels. */
export type Measure = (lines: string[], fontSizePx: number) => Box;

export interface FitRange {
  /** Never smaller than this, however long the line. */
  minPx: number;
  /** Never larger than this, which is the theme's own size. */
  maxPx: number;
  /** Stop when the search is this close, in pixels. */
  tolerancePx?: number;
}

function fits(box: Box, within: Box): boolean {
  // A fraction of a pixel over is not over. Browsers return fractional sizes
  // and a strict comparison makes the result flicker between two sizes.
  return box.width <= within.width + 0.5 && box.height <= within.height + 0.5;
}

/**
 * The largest size at which these lines fit the box.
 *
 * Binary search rather than stepping down, because a theme at 1080p can start
 * at 120px and stepping a pixel at a time is 120 layouts for one slide.
 */
export function largestFitting(
  lines: string[],
  within: Box,
  measure: Measure,
  range: FitRange,
): number {
  const tolerance = range.tolerancePx ?? 0.5;

  if (lines.length === 0) return range.maxPx;
  if (fits(measure(lines, range.maxPx), within)) return range.maxPx;

  let low = range.minPx;
  let high = range.maxPx;

  // The floor is a floor. Where even the smallest size overflows, it is
  // returned anyway and the overflow is a problem for the render harness to
  // report rather than something to hide by shrinking text nobody can read.
  if (!fits(measure(lines, low), within)) return low;

  while (high - low > tolerance) {
    const middle = (low + high) / 2;
    if (fits(measure(lines, middle), within)) low = middle;
    else high = middle;
  }

  return low;
}

/**
 * One size for a whole section: the largest that every slide in it can take.
 */
export function sectionSize(
  slides: string[][],
  within: Box,
  measure: Measure,
  range: FitRange,
): number {
  if (slides.length === 0) return range.maxPx;
  return slides.reduce(
    (smallest, lines) => Math.min(smallest, largestFitting(lines, within, measure, range)),
    range.maxPx,
  );
}

/**
 * The sizes already worked out, keyed by what they depend on.
 *
 * A key is the section, the theme, and the output's size, because those are the
 * three things that change the answer. Resizing a window invalidates nothing
 * else, and a theme change invalidates nothing else.
 */
export class FitCache {
  private readonly sizes = new Map<string, number>();
  private readonly limit: number;

  constructor(limit = 512) {
    this.limit = limit;
  }

  private static key(fitKey: string, themeId: string, within: Box): string {
    return `${fitKey}|${themeId}|${Math.round(within.width)}x${Math.round(within.height)}`;
  }

  get(fitKey: string, themeId: string, within: Box): number | undefined {
    return this.sizes.get(FitCache.key(fitKey, themeId, within));
  }

  /**
   * The size for this section, measured once and remembered.
   */
  resolve(
    fitKey: string,
    themeId: string,
    slides: string[][],
    within: Box,
    measure: Measure,
    range: FitRange,
  ): number {
    const key = FitCache.key(fitKey, themeId, within);
    const known = this.sizes.get(key);
    if (known !== undefined) return known;

    const size = sectionSize(slides, within, measure, range);

    if (this.sizes.size >= this.limit) {
      // Oldest out. A service is a few hundred slides, so this only matters
      // across a long rehearsal with the window being resized.
      const oldest = this.sizes.keys().next();
      if (!oldest.done) this.sizes.delete(oldest.value);
    }
    this.sizes.set(key, size);
    return size;
  }

  get size(): number {
    return this.sizes.size;
  }

  clear(): void {
    this.sizes.clear();
  }
}

/** The box text may occupy, given an output's size and the theme's inset. */
export function safeBox(viewport: Box, safeAreaFraction: number): Box {
  // The inset is a fraction of the shorter edge, so a wide screen does not get
  // an absurd left and right margin.
  const inset = Math.min(viewport.width, viewport.height) * safeAreaFraction;
  return {
    width: Math.max(1, viewport.width - inset * 2),
    height: Math.max(1, viewport.height - inset * 2),
  };
}
