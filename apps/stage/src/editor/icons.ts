/**
 * STG-145. The handful of marks this window needs.
 *
 * Drawn here rather than pulled from Lucide, because the icon package is React
 * and this window is plain DOM. The paths follow Lucide's geometry so that the
 * day this becomes a component it looks the same.
 *
 * Every one of these sits on a button that carries a name, so a person using a
 * screen reader hears "Move up" rather than a path (docs/design-system.md
 * section 12). An icon with nothing behind it is still refused.
 */

const NS = "http://www.w3.org/2000/svg";

type Shape =
  | { d: string }
  | { cx: number; cy: number }
  | { x: number; y: number; w: number; h: number };

const SHAPES: Record<string, Shape[]> = {
  "chevron-up": [{ d: "M18 15L12 9L6 15" }],
  "chevron-down": [{ d: "M6 9L12 15L18 9" }],
  trash: [
    { d: "M3 6H21" },
    { d: "M19 6V20A2 2 0 0 1 17 22H7A2 2 0 0 1 5 20V6" },
    { d: "M8 6V4A2 2 0 0 1 10 2H14A2 2 0 0 1 16 4V6" },
    { d: "M10 11V17" },
    { d: "M14 11V17" },
  ],
  copy: [
    { x: 9, y: 9, w: 13, h: 13 },
    { d: "M5 15H4A2 2 0 0 1 2 13V4A2 2 0 0 1 4 2H13A2 2 0 0 1 15 4V5" },
  ],
  clipboard: [
    { d: "M16 4H18A2 2 0 0 1 20 6V20A2 2 0 0 1 18 22H6A2 2 0 0 1 4 20V6A2 2 0 0 1 6 4H8" },
    { x: 8, y: 2, w: 8, h: 4 },
  ],
  note: [{ d: "M21 15A2 2 0 0 1 19 17H7L3 21V5A2 2 0 0 1 5 3H19A2 2 0 0 1 21 5Z" }],
  grip: [
    { cx: 9, cy: 5 },
    { cx: 9, cy: 12 },
    { cx: 9, cy: 19 },
    { cx: 15, cy: 5 },
    { cx: 15, cy: 12 },
    { cx: 15, cy: 19 },
  ],
};

export type IconName = keyof typeof SHAPES;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  for (const shape of SHAPES[name] ?? []) {
    if ("d" in shape) {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", shape.d);
      svg.append(path);
      continue;
    }
    if ("x" in shape) {
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", String(shape.x));
      rect.setAttribute("y", String(shape.y));
      rect.setAttribute("width", String(shape.w));
      rect.setAttribute("height", String(shape.h));
      rect.setAttribute("rx", "2");
      svg.append(rect);
      continue;
    }
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", String(shape.cx));
    dot.setAttribute("cy", String(shape.cy));
    dot.setAttribute("r", "1.2");
    dot.setAttribute("fill", "currentColor");
    dot.setAttribute("stroke", "none");
    svg.append(dot);
  }

  return svg;
}
