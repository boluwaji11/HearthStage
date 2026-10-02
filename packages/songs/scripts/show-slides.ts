/**
 * Types a presentation in and prints the slides it becomes.
 *
 * The thing STG-145 added, without opening a window: a title card, three
 * notices and a sermon outline, each one a slide somebody added, compiled to
 * the cues an operator advances through. No song anywhere in it.
 *
 *   pnpm --filter @hearth/songs slides
 *   pnpm --filter @hearth/songs slides -- --lines 2
 *
 * Developer facing, so the strings here are deliberately outside
 * `packages/i18n`. Nothing in this file reaches a church.
 */

import { compileDeck, lookupFrom, presentationsFrom } from "../src/deck";
import {
  newPresentation,
  presentationPlan,
  slideCount,
  slidesFrom,
  type Presentation,
  type SlideInput,
} from "../src/presentation";

const argument = process.argv.indexOf("--lines");
const maxLines = argument === -1 ? 4 : Number(process.argv[argument + 1] ?? 4);

/** One box per slide, which is what the editor holds. */
const BOXES: SlideInput[] = [
  { label: "Title", body: "Morning Service\nEveryone welcome" },
  { label: null, body: "Church lunch\nThe 12th, after the service\nBring something to share" },
  { label: null, body: "Youth group\nWednesdays, 7pm\nIn the hall" },
  { label: "Point 1", body: "God speaks first\nGenesis 1" },
  { label: "Point 2", body: "We answer\nAnd the answer is the week rather than the hour" },
  { label: "Point 3", body: "Then we go" },
];

const presentation: Presentation = {
  ...newPresentation("pres_demo", { title: "Morning Service, the slides" }),
  slides: slidesFrom("pres_demo", BOXES),
};

const bold = (text: string) => `\u001b[1m${text}\u001b[0m`;
const dim = (text: string) => `\u001b[2m${text}\u001b[0m`;
const rule = (char = "─") => dim(char.repeat(74));

const plan = presentationPlan(presentation, { date: "2026-10-04" });
const deck = compileDeck(plan, lookupFrom([]), {
  presentations: presentationsFrom([presentation]),
  limits: { maxLines },
});

console.log("");
console.log(bold(presentation.title));
console.log(
  dim(
    `${presentation.slides.length} typed  ·  ${slideCount(presentation, { maxLines })} on screen  ·  at most ${maxLines} lines a slide`,
  ),
);
console.log(rule());

for (const cue of deck.cues) {
  const tag = cue.label === null ? dim("¶") : bold(cue.label);
  const of = cue.slideCount > 1 ? dim(`  ${cue.slideIndex + 1}/${cue.slideCount}`) : "";
  console.log("");
  console.log(`${tag}${of}`);
  for (const line of cue.lines ?? []) console.log(`  ${line}`);
}

console.log("");
console.log(rule());
if (deck.problems.length === 0) {
  console.log(dim(`${deck.cues.length} cues, nothing wrong with it`));
} else {
  for (const problem of deck.problems) console.log(`  ${problem.code}`);
}
console.log("");
