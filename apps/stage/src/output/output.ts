/**
 * STG-11, STG-17. An output window.
 *
 * Deliberately the dumbest thing in the application. It receives an
 * `OutputState` and paints it. The deck, the position and the decision about
 * what is live all stay in main, so a crashed output comes back by being handed
 * current state rather than by replaying anything.
 *
 * Text fitting here is the theme's size against the viewport. Measured fitting,
 * where a long line reduces the slide and every slide in a section shares one
 * size, arrives with STG-18.
 */

import type { OutputContent, OutputState, ThemeState } from "@hearth/stage-protocol";
import { FitCache, safeBox, type Box } from "./fit";

const layers = [
  document.getElementById("layer-a") as HTMLDivElement,
  document.getElementById("layer-b") as HTMLDivElement,
];
const cover = document.getElementById("cover") as HTMLDivElement;

let front = 0;
let painted = -1;

const fitCache = new FitCache();
let lastState: OutputState | null = null;

/**
 * A hidden element with the slide's own typography, used to measure.
 *
 * Off screen rather than invisible, because `visibility: hidden` still takes
 * part in layout and `display: none` cannot be measured at all.
 */
const ruler = document.createElement("div");
ruler.setAttribute("aria-hidden", "true");
ruler.style.position = "fixed";
ruler.style.left = "-10000px";
ruler.style.top = "0";
ruler.style.visibility = "hidden";
ruler.style.whiteSpace = "pre";
ruler.style.pointerEvents = "none";
document.body.append(ruler);

function measureWith(theme: ThemeState) {
  return (lines: string[], fontSizePx: number): Box => {
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
 * The size the live section's text should be.
 *
 * Measured once per section, theme and output size, then remembered, so an
 * advance applies a number rather than running layout (ST21.1).
 */
function sizeFor(state: OutputState): number | null {
  if (state.content.kind !== "lyric") return null;

  const viewport: Box = { width: window.innerWidth, height: window.innerHeight };
  const within = safeBox(viewport, state.theme.safeArea);
  const maxPx = state.theme.textSize * viewport.height;

  return fitCache.resolve(
    state.content.fitKey,
    state.theme.id,
    state.content.fitSlides,
    within,
    measureWith(state.theme),
    {
      // The floor from ST20.4: cap height at 4% of output height. Below it the
      // words stop being readable from the back of the room, so the text stays
      // put and the overflow becomes a problem the render harness reports.
      minPx: 0.04 * viewport.height,
      maxPx,
    },
  );
}

function applyTheme(theme: ThemeState): void {
  const root = document.documentElement;
  root.style.setProperty("--font-family", theme.fontFamily);
  root.style.setProperty("--font-weight", String(theme.fontWeight));
  // A fraction of output height, so one theme is right on a projector and on a
  // foyer screen.
  root.style.setProperty("--text-size", `${theme.textSize * 100}vh`);
  root.style.setProperty("--line-height", String(theme.lineHeight));
  root.style.setProperty("--colour", theme.colour);
  root.style.setProperty("--background", theme.background);
  root.style.setProperty("--text-align", theme.textAlign);
  root.style.setProperty(
    "--justify",
    theme.verticalAlign === "top" ? "flex-start" : theme.verticalAlign === "bottom" ? "flex-end" : "center",
  );
  root.style.setProperty("--safe-area", `${theme.safeArea * 100}%`);
  root.style.setProperty("--transition", `${theme.transitionMs}ms`);
  root.style.setProperty("--text-shadow", theme.textShadow ?? "none");
}

function render(content: OutputContent): HTMLElement {
  const slide = document.createElement("div");
  slide.className = "slide";

  if (content.kind === "nothing") return slide;

  if (content.kind === "scripture") {
    const body = document.createElement("div");
    body.className = "lines scripture";
    for (const line of content.lines) {
      const element = document.createElement("p");
      element.textContent = line;
      body.append(element);
    }
    slide.append(body);

    // On every slide of the passage, because somebody arriving at slide three
    // still needs to know where they are (ST7.3).
    const reference = document.createElement("p");
    reference.className = "reference";
    reference.textContent = content.reference;
    slide.append(reference);
    return slide;
  }

  if (content.kind === "message") {
    const body = document.createElement("div");
    body.className = "lines";
    for (const line of content.lines) {
      const element = document.createElement("p");
      element.textContent = line;
      body.append(element);
    }
    slide.append(body);
    return slide;
  }

  const body = document.createElement("div");
  body.className = "lines";
  for (const line of content.lines) {
    const element = document.createElement("p");
    element.textContent = line;
    body.append(element);
  }
  slide.append(body);

  if (content.translation !== null) {
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

function paint(state: OutputState): void {
  // A revision older than what is on screen is a message that arrived late.
  if (state.revision < painted) return;
  painted = state.revision;

  applyTheme(state.theme);
  lastState = state;

  const size = sizeFor(state);
  document.documentElement.style.setProperty(
    "--text-size",
    size === null ? `${state.theme.textSize * 100}vh` : `${size}px`,
  );

  cover.dataset["blank"] = state.blank;

  const back = layers[1 - front] as HTMLDivElement;
  const fore = layers[front] as HTMLDivElement;

  back.replaceChildren(render(state.content));
  back.classList.add("visible");
  fore.classList.remove("visible");
  front = 1 - front;
}

/**
 * A resized output is measured again.
 *
 * Only a developer resizes a window, but a display changing mode mid-service is
 * the same event and the slide has to stay inside the safe area.
 */
window.addEventListener("resize", () => {
  if (lastState === null) return;
  painted = lastState.revision - 1;
  paint(lastState);
});

const bridge = window.hearth;

if (bridge === undefined) {
  // Without the bridge there is no way to receive state, and an output showing
  // a stack trace is worse than an output showing nothing.
  document.body.classList.add("detached");
} else {
  bridge.onOutputState(paint);
  void bridge.hello().then((state) => {
    if (state.output !== null) paint(state.output);
  });
}
