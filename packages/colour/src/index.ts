/**
 * OKLCH to sRGB, and WCAG contrast.
 *
 * Every colour in Hearth is OKLCH, so a contrast rule can be checked from the
 * values rather than from a screenshot. A screenshot test says a slide was fine
 * on the day it ran. This says a theme can never be wrong.
 *
 * **This is a port of the platform's `packages/ui/scripts/contrast.mjs`**, which
 * stayed behind when Stage moved to its own repository. The maths is the same
 * and the thresholds come from the same place, `docs/design-system.md` in the
 * platform: 4.5:1 for body text, 3:1 for a boundary somebody has to see without
 * reading, and **7:1 on anything read across a room**, which is every output
 * Stage drives.
 *
 * Two copies of colour maths is a cost of the repository split. It is a small
 * and stable piece of arithmetic, and the alternative was Stage importing a
 * package it cannot reach, so the duplication is deliberate and recorded here.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `oklch(L C H)`, `oklch(L C H / A)`, or `#rrggbb`. */
export function parseColour(value: string): Rgb {
  const text = value.trim();

  const hex = /^#([0-9a-f]{6})$/i.exec(text);
  if (hex !== null) {
    const number = Number.parseInt(hex[1] as string, 16);
    return {
      r: ((number >> 16) & 255) / 255,
      g: ((number >> 8) & 255) / 255,
      b: (number & 255) / 255,
    };
  }

  const oklch = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/.exec(text);
  if (oklch === null) throw new Error(`Cannot read the colour "${value}".`);

  return oklchToRgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
}

function oklchToRgb(lightness: number, chroma: number, hueDegrees: number): Rgb {
  const hue = (hueDegrees * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  // OKLab to LMS, cubed.
  const l = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const m = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const s = lightness - 0.0894841775 * a - 1.291485548 * b;

  const lCubed = l * l * l;
  const mCubed = m * m * m;
  const sCubed = s * s * s;

  // LMS to linear sRGB.
  return {
    r: 4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed,
    g: -1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed,
    b: -0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.707614701 * sCubed,
  };
}

/** WCAG relative luminance, with out-of-gamut values clamped. */
export function luminance(rgb: Rgb): number {
  const channel = (value: number): number => Math.min(1, Math.max(0, value));
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** The contrast ratio between two colours, from 1 to 21. */
export function contrast(a: string | Rgb, b: string | Rgb): number {
  const first = luminance(typeof a === "string" ? parseColour(a) : a);
  const second = luminance(typeof b === "string" ? parseColour(b) : b);
  const [high, low] = first > second ? [first, second] : [second, first];
  return (high + 0.05) / (low + 0.05);
}

/** The floor for anything read across a room, which is every Stage output. */
export const ACROSS_A_ROOM = 7;
/** The floor for body text on a screen somebody is sitting at. */
export const BODY_TEXT = 4.5;
/** The floor for a boundary somebody has to see without reading it. */
export const UI_BOUNDARY = 3;
