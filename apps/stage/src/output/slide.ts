/**
 * STG-17, STG-18, STG-21. One slide, painted once.
 *
 * The output window and the control surface's live and next panes both come
 * through here. **What the operator is looking at has to be the room's slide at
 * a smaller size**, and the only way to be sure of that is for one piece of code
 * to draw both. Two implementations drift, and the first anybody hears of the
 * drift is somebody saying the screen looked different from the preview.
 *
 * Nothing here reaches the network, the filesystem or Electron. It takes an
 * `OutputContent` and a `ThemeState` and returns elements.
 */

import { gradientCss, type Blank, type OutputContent, type ThemeState } from "@hearth/stage-protocol";
import { FitCache, safeBox, type Box, type Measure } from "./fit";

/** The theme, as the custom properties slide.css reads. */
export function applyTheme(target: HTMLElement, theme: ThemeState): void {
  const set = (name: string, value: string): void => target.style.setProperty(name, value);

  set("--font-family", theme.fontFamily);
  set("--font-weight", String(theme.fontWeight));
  // A fraction of output height, so one theme is right on a projector and on a
  // foyer screen. Replaced by a measured pixel size where one is worked out.
  set("--text-size", `${theme.textSize * 100}%`);
  set("--line-height", String(theme.lineHeight));
  set("--colour", theme.colour);
  set("--background-colour", theme.background);
  set("--background", gradientCss(theme.gradient, theme.background));
  set("--text-align", theme.textAlign);
  set(
    "--justify",
    theme.verticalAlign === "top"
      ? "flex-start"
      : theme.verticalAlign === "bottom"
        ? "flex-end"
        : "center",
  );
  set("--safe-area", `${theme.safeArea * 100}%`);
  set("--transition", `${theme.transitionMs}ms`);
  set("--text-shadow", theme.textShadow ?? "none");
}

/** The slide, as elements. */
export function renderSlide(content: OutputContent): HTMLElement {
  const slide = document.createElement("div");
  slide.className = "slide";

  if (content.kind === "nothing") return slide;

  if (content.kind === "countdown") {
    const clock = document.createElement("p");
    clock.className = "countdown";
    clock.dataset["endsAt"] = String(content.endsAt);
    clock.textContent = remaining(content.endsAt);
    slide.append(clock);

    if (content.message !== null) {
      const under = document.createElement("p");
      under.className = "countdown-message";
      under.textContent = content.message;
      slide.append(under);
    }
    return slide;
  }

  const body = document.createElement("div");
  body.className = content.kind === "scripture" ? "lines scripture" : "lines";
  for (const line of content.lines) {
    const element = document.createElement("p");
    element.textContent = line;
    body.append(element);
  }
  slide.append(body);

  if (content.kind === "scripture") {
    // On every slide of the passage, because somebody arriving at slide three
    // still needs to know where they are (ST7.3).
    const reference = document.createElement("p");
    reference.className = "reference";
    reference.textContent = content.reference;
    slide.append(reference);
    return slide;
  }

  if (content.kind === "lyric" && content.translation !== null) {
    const translation = document.createElement("div");
    translation.className = "lines translation";
    for (const line of content.translation) {
      const element = document.createElement("p");
      element.textContent = line;
      translation.append(element);
    }
    slide.append(translation);
  }

  return slide;
}

/**
 * A hidden element with the slide's own typography, used to measure.
 *
 * Off screen rather than invisible, because `visibility: hidden` still takes
 * part in layout and `display: none` cannot be measured at all. One per window.
 */
export function createRuler(): HTMLDivElement {
  const ruler = document.createElement("div");
  ruler.setAttribute("aria-hidden", "true");
  ruler.style.position = "fixed";
  ruler.style.left = "-10000px";
  ruler.style.top = "0";
  ruler.style.visibility = "hidden";
  ruler.style.whiteSpace = "pre";
  ruler.style.pointerEvents = "none";
  document.body.append(ruler);
  return ruler;
}

export function measureWith(ruler: HTMLElement, theme: ThemeState): Measure {
  return (lines, fontSizePx) => {
    ruler.style.fontFamily = theme.fontFamily;
    ruler.style.fontWeight = String(theme.fontWeight);
    ruler.style.lineHeight = String(theme.lineHeight);
    ruler.style.fontSize = `${fontSizePx}px`;
    ruler.textContent = lines.join("\n");
    const box = ruler.getBoundingClientRect();
    return { width: box.width, height: box.height };
  };
}

/**
 * The size this content's text should be, in a box of this size.
 *
 * Measured once per section, theme and box, then remembered, so an advance
 * applies a number rather than running layout (ST21.1). The same call gives the
 * output its size at full resolution and a control pane its size at a tenth of
 * it, which is what makes the preview proportionally honest.
 */
export function sizeFor(
  content: OutputContent,
  theme: ThemeState,
  viewport: Box,
  cache: FitCache,
  ruler: HTMLElement,
): number | null {
  if (content.kind !== "lyric" && content.kind !== "slide") return null;
  if (viewport.height <= 0 || viewport.width <= 0) return null;

  const within = safeBox(viewport, theme.safeArea);

  return cache.resolve(
    content.fitKey,
    theme.id,
    content.fitSlides,
    within,
    measureWith(ruler, theme),
    {
      // The floor from ST20.4: cap height at 4% of output height. Below it the
      // words stop being readable from the back of the room, so the text stays
      // put and the overflow becomes a problem the render harness reports.
      minPx: 0.04 * viewport.height,
      maxPx: theme.textSize * viewport.height,
    },
  );
}

/**
 * What goes over the slide when the operator clears the room (STG-22, ST6.6).
 *
 * The slide stays underneath untouched, so coming back is a cover going
 * transparent rather than a slide being rendered again. That is what "restores
 * the exact slide" means: there is nothing to restore, because nothing left.
 *
 * Here rather than in each window, so the operator's live pane and the wall
 * cannot draw the same blank two ways.
 */
export function coverInto(cover: HTMLElement, blank: Blank, logo: string | null): void {
  cover.dataset["blank"] = blank;
  cover.replaceChildren();
  // A church with no logo gets the ground, which is what the key did before
  // there was a logo to show. Nothing ships a default, because a screen at the
  // front of somebody's building is not a place to put our name.
  if (blank !== "logo" || logo === null) return;

  const mark = document.createElement("img");
  mark.className = "cover-logo";
  mark.src = logo;
  mark.alt = "";
  cover.append(mark);
}

/**
 * The time left on a countdown, as a room reads a clock (STG-26, ST5.10).
 *
 * Minutes and seconds, and hours only once there is an hour to show, because
 * `00:04:59` on a wall is three characters nobody needs. It stops at zero
 * rather than counting upwards: a service that has started does not need a
 * clock saying how late it is, in front of the people who are late.
 */
export function remaining(endsAt: number, now: number = Date.now()): string {
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const hours = Math.floor(left / 3600);
  const minutes = Math.floor((left % 3600) / 60);
  const seconds = left % 60;
  const pad = (value: number): string => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/**
 * Keeps every clock in a window on the right second.
 *
 * One timer per window rather than one per element, and it reads the moment off
 * the element it is updating, so a control pane and an output window never
 * disagree and nothing counts in main.
 */
export function tickClocks(root: ParentNode = document): () => void {
  const update = (): void => {
    for (const clock of root.querySelectorAll<HTMLElement>(".countdown[data-ends-at]")) {
      const endsAt = Number(clock.dataset["endsAt"]);
      if (Number.isFinite(endsAt)) clock.textContent = remaining(endsAt);
    }
  };

  update();
  const timer = window.setInterval(update, 250);
  return () => window.clearInterval(timer);
}
