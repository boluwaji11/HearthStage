/**
 * Everything Hearth Stage can do so far, in one run.
 *
 * Stage has no window yet. What exists is the shared song domain and the
 * library on disk, and this walks through both so they can be looked at rather
 * than read about.
 *
 *   pnpm stage:demo
 *
 * Plain node and no dependencies, so it works in a fresh checkout before
 * anything is installed beyond the workspace itself.
 */

import { spawnSync } from "node:child_process";

const bold = (text) => `\u001b[1m${text}\u001b[0m`;
const dim = (text) => `\u001b[2m${text}\u001b[0m`;
const rule = () => dim("━".repeat(76));

const steps = [
  {
    title: "1. A Sunday service, compiled into slides",
    why:
      "Every slide below came out of the song records and the arrangement sequences,\n" +
      "with nobody typing a slide. Watch for the repeated verse in Holy, Holy, Holy,\n" +
      "the key of Bb on Amazing Grace although its arrangement is in G, the sermon\n" +
      "sitting in the deck with nothing on the screen, and Psalm 23 breaking at verse\n" +
      "boundaries with its reference on both slides.",
    filter: "@hearth/songs",
    script: "deck",
    args: [],
  },
  {
    title: "2. The same service with room for two lines a slide",
    why: "Every section splits, and a break always falls between two lines.",
    filter: "@hearth/songs",
    script: "deck",
    args: ["--lines", "2"],
  },
  {
    title: "3. A chord chart, as written",
    why: "Chords sitting over the words they belong to.",
    filter: "@hearth/songs",
    script: "chart",
    args: [],
  },
  {
    title: "4. The same chart in Bb",
    why:
      "Eb, where a naive transposition gives D#. Spelling follows the target key,\n" +
      "because a chart in Bb with a D# in it gets read twice by every player who sees\n" +
      "it. The slash chord moves both notes, D/F# becomes F/A, and the words do not\n" +
      "move at all. Try --key A and the same chart comes out with sharps in it.",
    filter: "@hearth/songs",
    script: "chart",
    args: ["--key", "Bb"],
  },
  {
    title: "5. The library on the laptop, destroyed and brought back",
    why:
      "For a church that never pairs with the platform, this file is the only copy of\n" +
      "its work. Watch it refuse a song whose lyrics are one string with newlines in\n" +
      "it, refuse a synced song, archive one without deleting it, then lose the whole\n" +
      "database and restore every section, arrangement and chart from the backup.",
    filter: "@hearth/stage-store",
    script: "library",
    args: [],
  },
];

console.log("");
console.log(bold("Hearth Stage, so far"));
console.log(
  dim(
    "The shared song domain and the library on disk. No window yet: that is STG-11.\n" +
      "Specification in PRD-STAGE.md, the board in BACKLOG-STAGE.md.",
  ),
);

let failed = 0;

for (const step of steps) {
  console.log("");
  console.log(rule());
  console.log(bold(step.title));
  console.log(dim(step.why));
  console.log(rule());

  const command = ["--filter", step.filter, "run", step.script];
  if (step.args.length > 0) command.push("--", ...step.args);

  const result = spawnSync("pnpm", command, { stdio: "inherit" });
  if (result.status !== 0) failed += 1;
}

console.log("");
console.log(rule());
if (failed === 0) {
  console.log(bold("All five ran."));
  console.log(dim("The tests behind them: pnpm --filter @hearth/songs --filter @hearth/stage-store test"));
} else {
  console.log(bold(`${failed} of ${steps.length} failed. Run pnpm install first.`));
}
console.log("");
