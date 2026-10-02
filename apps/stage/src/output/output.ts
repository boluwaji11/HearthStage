/**
 * STG-11, STG-17. An output window.
 *
 * Deliberately the dumbest thing in the application. It receives an
 * `OutputState` and paints it. The deck, the position and the decision about
 * what is live all stay in main, so a crashed output comes back by being handed
 * current state rather than by replaying anything.
 *
 * The slide itself is drawn by `slide.ts`, which the control surface uses too,
 * so the operator's live pane is this window at a smaller size (STG-21).
 */

import type { OutputState } from "@hearth/stage-protocol";
import { FitCache } from "./fit";
import { applyTheme, createRuler, renderSlide, sizeFor } from "./slide";

const layers = [
  document.getElementById("layer-a") as HTMLDivElement,
  document.getElementById("layer-b") as HTMLDivElement,
];
const cover = document.getElementById("cover") as HTMLDivElement;

let front = 0;
let painted = -1;

const fitCache = new FitCache();
const ruler = createRuler();
let lastState: OutputState | null = null;

function paint(state: OutputState): void {
  // A revision older than what is on screen is a message that arrived late.
  if (state.revision < painted) return;
  painted = state.revision;

  applyTheme(document.documentElement, state.theme);
  lastState = state;

  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const size = sizeFor(state.content, state.theme, viewport, fitCache, ruler);
  document.documentElement.style.setProperty(
    "--text-size",
    size === null ? `${state.theme.textSize * 100}vh` : `${size}px`,
  );

  cover.dataset["blank"] = state.blank;

  const back = layers[1 - front] as HTMLDivElement;
  const fore = layers[front] as HTMLDivElement;

  back.replaceChildren(renderSlide(state.content));
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
