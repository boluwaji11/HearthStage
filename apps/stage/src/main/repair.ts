/**
 * Putting back the orders an older build wiped (STG-9).
 *
 * Saving a sample song in the editor before STG-9 replaced every order it held
 * with one called "As written", because the editor had no way to show an order
 * and the save path built one from the sections. The sample service names its
 * orders by id (R11.4), so the three songs in it came up asking for orders the
 * library no longer had, and a church that opened the sample saw three
 * problems it had no way to act on.
 *
 * The signature is exact: a sample song holding that one order and none of the
 * ones it shipped with. A church that has made its own orders, renamed the one
 * it was given, or still has the originals is left alone, because putting an
 * order back that somebody deliberately took away is worse than the problem.
 *
 * It runs once per launch and does nothing on a library that has never been
 * damaged, so it costs one read per sample song.
 */

import type { WholeSong } from "@hearth/songs";
import { DEFAULT_ARRANGEMENT_NAME } from "./songs";

/**
 * The song as it should be stored, or null where there is nothing to repair.
 *
 * The order the church is left on stays the default, so a repaired library
 * presents what it presented a moment ago and the sample service stops asking
 * for something that is not there.
 */
export function restoredOrders(stored: WholeSong, sample: WholeSong): WholeSong | null {
  if (stored.song.id !== sample.song.id) return null;
  if (stored.arrangements.length !== 1) return null;

  const only = stored.arrangements[0];
  if (only === undefined || only.name !== DEFAULT_ARRANGEMENT_NAME) return null;

  const held = new Set(stored.arrangements.map((one) => one.id));
  if (sample.arrangements.some((one) => held.has(one.id))) return null;

  // Only the ones the song can still sing. A church that renamed or removed a
  // section has a song the original order no longer fits.
  const labels = new Set(stored.sections.map((section) => section.label));
  const names = new Set(stored.arrangements.map((one) => one.name));
  const back = sample.arrangements
    .filter((one) => one.sequence.length > 0 && one.sequence.every((label) => labels.has(label)))
    .filter((one) => !names.has(one.name))
    .map((one) => ({ ...one, isDefault: false }));

  if (back.length === 0) return null;
  return { ...stored, arrangements: [...stored.arrangements, ...back] };
}
