/**
 * STG-24, ST5.7. The order a service actually runs in.
 *
 * A set list is what a church planned on Thursday. What happens on Sunday is
 * that the preacher overruns, so the last verse goes, and the chorus goes round
 * one more time because the room is still singing. The operator does both from
 * the deck list while the service is running.
 *
 * **None of it reaches the set list.** This is a layer over the compiled deck,
 * held for as long as the service is open, and opening the service again gives
 * the order the church planned. A church that wants the change to stick edits
 * the set list, which is a different thing done on a different day.
 *
 * **An entry is not a cue.** Repeating a chorus puts a second entry against one
 * cue, so an entry has its own identity and the two can be skipped, moved and
 * taken away separately.
 *
 * **Moving is within a group.** Singing verse three before verse two is a
 * Sunday morning decision. Moving a song to the other end of the service is a
 * set list decision, and doing it here would leave the room looking at an order
 * nobody has on paper.
 */

import type { Deck } from "@hearth/songs";

export interface RunEntry {
  /** Unique. A repeated cue has two entries and they are told apart by this. */
  id: string;
  cueId: string;
  /** Which group it belongs to, which is as far as it can be moved. */
  groupId: string;
  skipped: boolean;
  /** True on a copy somebody added. Only a copy can be taken away again. */
  repeat: boolean;
}

export type RunChange = "skip" | "repeat" | "up" | "down" | "drop";

export const RUN_CHANGES: RunChange[] = ["skip", "repeat", "up", "down", "drop"];

export function isRunChange(value: unknown): value is RunChange {
  return typeof value === "string" && RUN_CHANGES.includes(value as RunChange);
}

/** The order the church planned, which is where every service starts. */
export function runFrom(deck: Deck): RunEntry[] {
  return deck.cues.map((cue) => ({
    id: `${cue.id}#1`,
    cueId: cue.id,
    groupId: cue.groupId,
    skipped: false,
    repeat: false,
  }));
}

/** The entries that will actually be shown, in order. */
export function showing(order: RunEntry[]): RunEntry[] {
  return order.filter((entry) => !entry.skipped);
}

/**
 * Whether this is still the order the church planned.
 *
 * Compared against the deck rather than against the entries, because moving a
 * verse leaves every entry exactly as it was and only the order different.
 */
export function asPlanned(order: RunEntry[], deck: Deck): boolean {
  if (order.length !== deck.cues.length) return false;
  return order.every((entry, index) => {
    if (entry.skipped || entry.repeat) return false;
    return entry.cueId === deck.cues[index]?.id;
  });
}

function nextIdFor(order: RunEntry[], cueId: string): string {
  const taken = new Set(order.map((entry) => entry.id));
  let n = 2;
  while (taken.has(`${cueId}#${n}`)) n += 1;
  return `${cueId}#${n}`;
}

/**
 * One change, returning the order it makes, or null where it does nothing.
 *
 * Null rather than the same list, so main can tell the difference between a
 * change and a button that did nothing, and leave the revision alone.
 */
export function applyChange(
  order: RunEntry[],
  entryId: string,
  change: RunChange,
): RunEntry[] | null {
  const at = order.findIndex((entry) => entry.id === entryId);
  if (at === -1) return null;
  const entry = order[at] as RunEntry;

  switch (change) {
    case "skip":
      return order.map((candidate) =>
        candidate.id === entryId ? { ...candidate, skipped: !candidate.skipped } : candidate,
      );

    case "repeat": {
      // The copy goes straight after, which is where a chorus going round again
      // belongs and is where an operator looks for it.
      const copy: RunEntry = {
        ...entry,
        id: nextIdFor(order, entry.cueId),
        skipped: false,
        repeat: true,
      };
      return [...order.slice(0, at + 1), copy, ...order.slice(at + 1)];
    }

    case "drop":
      // Only a copy. Taking away an entry the set list put there would be an
      // operator deleting a verse with no way back, and that is what skip is
      // for.
      if (!entry.repeat) return null;
      return order.filter((candidate) => candidate.id !== entryId);

    case "up":
    case "down": {
      const to = change === "up" ? at - 1 : at + 1;
      const neighbour = order[to];
      // The ends of the list, and the ends of the group. A cue leaving its
      // group would put the room in an order nobody has on paper.
      if (neighbour === undefined || neighbour.groupId !== entry.groupId) return null;
      const moved = [...order];
      moved[at] = neighbour;
      moved[to] = entry;
      return moved;
    }

    default:
      return null;
  }
}
