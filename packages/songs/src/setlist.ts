/**
 * STG-46, ST2.8. The running order a church types for one service.
 *
 * A standalone church presents from one of these. A paired church receives a
 * plan from Hearth instead (ST5.3), and both arrive at the deck compiler as a
 * `ServicePlan`, so everything downstream of it is written once.
 *
 * **An entry points at the library rather than copying it.** Fixing a typo in a
 * hymn fixes it in next Sunday's order as well, which is the whole reason a
 * library exists. The title is stored beside the reference so a set list still
 * reads as a running order when an item has been archived, and the compiler
 * reports the missing item by name rather than leaving a hole.
 *
 * **A marker holds no item.** "Sermon", "Offering", "Communion": the screen
 * shows nothing, the order still says what is happening, and the operator knows
 * the next press is the song after it (ST5.4).
 */

import type { MarkerItem, PresentationItem, ServiceItem, ServicePlan, SongItem } from "./service";

export const SET_ENTRY_KINDS = ["item", "marker"] as const;

export type SetEntryKind = (typeof SET_ENTRY_KINDS)[number];

export interface SetEntry {
  id: string;
  setListId: string;
  sortOrder: number;
  kind: SetEntryKind;
  /** The library item this stands for. Null on a marker. */
  itemId: string | null;
  /** What the order calls it: the item's title, or the marker's words. */
  title: string;
  notes: string | null;
}

export interface SetList {
  id: string;
  title: string;
  /** The service date in the church's timezone, YYYY-MM-DD. */
  date: string;
  entries: SetEntry[];
  updatedAt: string | null;
}

/** Which table a library item is in, so an entry becomes the right kind. */
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_KINDS = ["song", "presentation"] as const;

export type SetListProblemCode =
  | "title.missing"
  | "date.invalid"
  | "entries.none"
  | "entry.item.missing"
  | "entry.title.missing";

export interface SetListProblem {
  code: SetListProblemCode;
  severity: "error" | "warning";
  sortOrder?: number;
  title?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * What is wrong with a set list, before it is stored.
 *
 * An empty one is a warning rather than an error, the same as a presentation
 * with no slides: a church names next Sunday on a Tuesday and fills it in on a
 * Thursday.
 */
export function validateSetList(list: SetList): SetListProblem[] {
  const problems: SetListProblem[] = [];

  if (list.title.trim() === "") problems.push({ code: "title.missing", severity: "error" });
  if (!DATE.test(list.date)) problems.push({ code: "date.invalid", severity: "error" });
  if (list.entries.length === 0) problems.push({ code: "entries.none", severity: "warning" });

  for (const entry of list.entries) {
    if (entry.title.trim() === "") {
      problems.push({ code: "entry.title.missing", severity: "error", sortOrder: entry.sortOrder });
    }
    if (entry.kind === "item" && (entry.itemId === null || entry.itemId === "")) {
      problems.push({ code: "entry.item.missing", severity: "error", sortOrder: entry.sortOrder });
    }
  }

  return problems;
}

export function setListHasErrors(problems: SetListProblem[]): boolean {
  return problems.some((problem) => problem.severity === "error");
}

/** The entries in the order they are presented, whatever order they are held. */
export function orderedEntries(list: SetList): SetEntry[] {
  return [...list.entries].sort((left, right) => left.sortOrder - right.sortOrder);
}

/**
 * The set list as the deck compiler takes it.
 *
 * `kindOf` says which table an item is in. An entry naming something that is no
 * longer there still becomes an item, so the compiler reports it by name and
 * the operator finds out before the service rather than during it.
 */
export function setListPlan(
  list: SetList,
  kindOf: (itemId: string) => ItemKind | undefined,
): ServicePlan {
  const items: ServiceItem[] = orderedEntries(list).map((entry, index) => {
    const shared = {
      id: entry.id,
      sortOrder: index,
      title: entry.title,
      durationSeconds: null,
      notes: entry.notes === null ? [] : [{ position: null, body: entry.notes }],
    };

    if (entry.kind === "marker") {
      // "custom", because the words a church typed are the kind. A picker of
      // eight kinds is a question nobody on a Tuesday evening wants asked.
      return { ...shared, type: "marker", kind: "custom" } satisfies MarkerItem;
    }

    const itemId = entry.itemId ?? "";
    if (kindOf(itemId) === "song") {
      return {
        ...shared,
        type: "song",
        songId: itemId,
        arrangementId: null,
        keyOverride: null,
      } satisfies SongItem;
    }

    return { ...shared, type: "presentation", presentationId: itemId } satisfies PresentationItem;
  });

  return {
    id: list.id,
    source: "set_list",
    title: list.title,
    date: list.date,
    startsAt: null,
    items,
  };
}

/**
 * Last week's order, again (STG-47, ST2.9).
 *
 * The structure comes across and the date moves on by a week, because a church
 * meeting on a Sunday meets again on the Sunday after. The name comes across
 * too: a church calls it the same thing every week, and anybody who does not
 * types over it.
 */
export function duplicateSetList(list: SetList, id: string): SetList {
  return {
    id,
    title: list.title,
    date: aWeekAfter(list.date),
    updatedAt: null,
    entries: orderedEntries(list).map((entry, index) => ({
      ...entry,
      id: `${id}:entry:${index}`,
      setListId: id,
      sortOrder: index,
    })),
  };
}

/** The same weekday, seven days on. */
export function aWeekAfter(date: string): string {
  if (!DATE.test(date)) return date;
  const at = new Date(`${date}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + 7);
  return at.toISOString().slice(0, 10);
}

/** A set list with nothing in it, for the day somebody starts next Sunday. */
export function newSetList(id: string, options: { title?: string; date?: string } = {}): SetList {
  return {
    id,
    title: options.title ?? "",
    date: options.date ?? new Date().toISOString().slice(0, 10),
    entries: [],
    updatedAt: null,
  };
}

/** Enough of a presentation plan to choose between them (STG-48). */
export interface Dated {
  id: string;
  title: string;
  date: string;
}

/**
 * The plan a church most likely wants at launch (STG-48, ST12.5).
 *
 * The soonest one that has not happened yet, counting today, because a church
 * opens Stage on the morning of the service far more often than on any other
 * day. With nothing ahead it is the most recent one behind, which is the case
 * on a Monday when somebody opens last week's to look at it.
 *
 * Dates are `YYYY-MM-DD`, so comparing them as strings compares them as dates.
 * A tie goes to the title, which keeps two services on one day in a stable
 * order rather than whichever the store happened to return first.
 */
export function nextUp<T extends Dated>(lists: readonly T[], today: string): T | null {
  const ahead = lists
    .filter((list) => list.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  if (ahead[0] !== undefined) return ahead[0];

  const behind = [...lists].sort(
    (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
  );
  return behind[0] ?? null;
}
