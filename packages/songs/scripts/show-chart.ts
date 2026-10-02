/**
 * Prints a chord chart, transposed, with the chords over the words.
 *
 * The same resolution Stage's confidence monitor will use and the same one the
 * platform's printed chart will use, which is the point of it living in a
 * shared package (ST11.3, R12.6).
 *
 *   pnpm --filter @hearth/songs chart
 *   pnpm --filter @hearth/songs chart -- --key Bb
 *   pnpm --filter @hearth/songs chart -- --song holy --key F
 *
 * Developer facing, so these strings are deliberately outside `packages/i18n`.
 */

import { chordsIn, chordsOverLyrics, keyOf, transposeChordPro } from "../src/chords";
import { amazingGrace, holyHolyHoly } from "../src/fixtures";
import { isKey, type Key } from "../src/keys";

function argument(name: string): string | null {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? null : (process.argv[at + 1] ?? null);
}

const which = argument("song") ?? "grace";
const whole = which.startsWith("holy") ? holyHolyHoly : amazingGrace;
const arrangement = whole.arrangements.find((candidate) => candidate.chordpro !== null);

if (arrangement === undefined || arrangement.chordpro === null) {
  console.error(`No chart on ${whole.song.title}.`);
  process.exit(1);
}

const from = arrangement.key;
const asked = argument("key");

if (asked !== null && !isKey(asked)) {
  console.error(`"${asked}" is not a key this understands.`);
  process.exit(1);
}

const to: Key = (asked as Key | null) ?? from;
const chart = transposeChordPro(arrangement.chordpro, from, to);

const bold = (text: string) => `\u001b[1m${text}\u001b[0m`;
const dim = (text: string) => `\u001b[2m${text}\u001b[0m`;

console.log("");
console.log(bold(`${whole.song.title}  ${dim(`· ${arrangement.name}`)}`));
console.log(
  dim(
    `written in ${from}, showing in ${keyOf(chart) ?? to}` +
      (to === from ? "" : `  ·  transposed from ${from}`),
  ),
);
console.log(dim(`chords used: ${chordsIn(chart).join("  ")}`));
console.log("");

for (const row of chordsOverLyrics(chart)) {
  console.log(row.startsWith("{") || row.startsWith("#") ? dim(row) : row);
}

console.log("");
if (to !== from) {
  console.log(dim(`Same chart in ${from}: pnpm --filter @hearth/songs chart`));
  console.log("");
}
