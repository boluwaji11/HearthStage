/**
 * Prints a compiled deck to the terminal.
 *
 * Stage has no window yet, and the deck compiler is the part of it that is
 * finished, so this is how it gets looked at. Every slide below came out of the
 * song records and the arrangement sequences with nobody typing a slide, which
 * is the thing the schema exists to make possible.
 *
 *   pnpm --filter @hearth/songs deck
 *   pnpm --filter @hearth/songs deck -- --lines 2
 *
 * Developer facing, so the strings here are deliberately outside
 * `packages/i18n`. Nothing in this file reaches a church.
 */

import { compileDeck, lookupFrom } from "../src/deck";
import { sampleLibrary, sundayService } from "../src/fixtures";
import { formatSequence } from "../src/sequence";
import { notesFor, plannedSeconds } from "../src/service";

const argument = process.argv.indexOf("--lines");
const maxLines = argument === -1 ? 4 : Number(process.argv[argument + 1] ?? 4);

const deck = compileDeck(sundayService, lookupFrom(sampleLibrary), {
  limits: { maxLines },
});

const bold = (text: string) => `\u001b[1m${text}\u001b[0m`;
const dim = (text: string) => `\u001b[2m${text}\u001b[0m`;
const rule = (char = "─") => dim(char.repeat(74));

function minutes(seconds: number): string {
  const whole = Math.round(seconds / 60);
  return `${whole} min`;
}

console.log("");
console.log(bold(`${deck.title}  ${deck.date}`));
console.log(
  dim(
    `${deck.source === "set_list" ? "Stage set list" : "Hearth plan"} · ` +
      `${deck.groups.length} items · ${deck.cues.length} cues · ` +
      `${minutes(plannedSeconds(sundayService))} planned · ${maxLines} lines a slide`,
  ),
);
console.log(rule());

for (const group of deck.groups) {
  const facts: string[] = [];
  if (group.key !== null) facts.push(`key of ${group.key}`);
  if (group.tempoBpm !== null) facts.push(`${group.tempoBpm} bpm`);
  if (group.sequence.length > 0) facts.push(formatSequence(group.sequence));
  if (group.durationSeconds !== null) facts.push(minutes(group.durationSeconds));

  console.log("");
  console.log(`${bold(group.title)}  ${dim(facts.join("  ·  "))}`);

  // What the person on drums would see: the global notes plus their own, and
  // not the ones addressed to somebody else (R11.6).
  const item = sundayService.items.find((candidate) => candidate.id === group.itemId);
  if (item !== undefined) {
    for (const note of notesFor(item, "Drums")) {
      console.log(dim(`  note${note.position === null ? "" : ` to ${note.position}`}: ${note.body}`));
    }
  }

  if (group.kind === "marker") {
    console.log(dim("  nothing on the screen"));
    continue;
  }

  for (const cue of group.cues) {
    const tag =
      cue.label === null
        ? (cue.reference ?? "")
        : `${cue.label}${cue.occurrencesTotal > 1 ? ` (${cue.occurrence} of ${cue.occurrencesTotal})` : ""}`;
    const of = cue.slideCount > 1 ? ` ${cue.slideIndex + 1}/${cue.slideCount}` : "";

    console.log(dim(`  ${String(cue.position + 1).padStart(3)}  ${tag}${of}`));
    for (const line of cue.lines ?? []) {
      console.log(`       ${line}`);
    }
  }
}

console.log("");
console.log(rule());
if (deck.problems.length === 0) {
  console.log(dim("No problems. Every cue above resolved from a song record."));
} else {
  console.log(bold(`${deck.problems.length} problems:`));
  for (const problem of deck.problems) {
    console.log(`  ${problem.code}  ${JSON.stringify(problem)}`);
  }
}
console.log("");
