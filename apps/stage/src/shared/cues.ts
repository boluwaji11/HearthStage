/**
 * STG-50, ST5.9. Finding a cue by the name the leader says out loud.
 *
 * "Back to the chorus" is `C`, "second chorus" is `C2`, and the operator has
 * about two seconds. The whole of it is matching what somebody typed against
 * the labels in the deck, so it lives here as a function rather than inside the
 * window, where it could only be tested by opening one.
 *
 * It never matches a cue the operator has taken out of this run. Jumping into
 * something that was deliberately skipped would put a verse on the wall that
 * somebody decided the church was not singing.
 */

/** Enough of a cue to find it by name. */
export interface Named {
  entryId: string;
  label: string | null;
  occurrence: number;
  skipped: boolean;
}

/** `  c2 ` and `C2` are the same thing to somebody typing in a hurry. */
function tidy(typed: string): string {
  return typed.trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * The cue somebody meant, or null.
 *
 * An exact label wins, because a song with two choruses labels them `C1` and
 * `C2` and that is what the order says. Failing that, `C2` is read as the
 * second time `C` comes round, which is what it means in a song whose chorus is
 * sung twice off one section.
 */
export function findCue(cues: readonly Named[], typed: string): Named | null {
  const wanted = tidy(typed);
  if (wanted === "") return null;

  const live = cues.filter((cue) => !cue.skipped && cue.label !== null);

  const exact = live.find((cue) => tidy(cue.label ?? "") === wanted);
  if (exact !== undefined) return exact;

  const split = /^([A-Z]+)(\d+)$/.exec(wanted);
  if (split !== null) {
    const [, prefix = "", count = ""] = split;
    const nth = live.find(
      (cue) => tidy(cue.label ?? "") === prefix && cue.occurrence === Number(count),
    );
    if (nth !== undefined) return nth;
  }

  return null;
}
