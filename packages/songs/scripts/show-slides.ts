/**
 * Types a presentation in and prints the slides it becomes.
 *
 * The thing STG-145 added, without opening a window: a title card, three
 * notices and a sermon outline, typed as plain text with a blank line between
 * slides, compiled to the cues an operator advances through. No song anywhere
 * in it.
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
  parseSlides,
  presentationPlan,
  slideCount,
  type Presentation,
} from "../src/presentation";

const argument = process.argv.indexOf("--lines");
const maxLines = argument === -1 ? 4 : Number(process.argv[argument + 1] ?? 4);

const TYPED = `[Title]
Morning Service
Everyone welcome

Church lunch
The 12th, after the service
Bring something to share

Youth group
Wednesdays, 7pm
In the hall

[Point 1]
God speaks first
Genesis 1

[Point 2]
We answer
And the answer is the week, not the hour

[Point 3]
Then we go`;

const presentation: Presentation = {
  ...newPresentation("pres_demo", { title: "Morning Service, the slides" }),
  slides: parseSlides(TYPED, { presentationId: "pres_demo" }),
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
