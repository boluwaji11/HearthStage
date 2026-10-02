/**
 * STG-9. The orders an older build wiped.
 *
 * The damage is real and it is on laptops: a church that opened Amazing Grace
 * in the editor before STG-9 lost the two orders it shipped with, and the
 * sample service came up asking for both. These tests are mostly about what the
 * repair refuses to touch, because putting an order back that somebody took
 * away on purpose is the worse defect of the two.
 */
import { describe, it, expect } from "vitest";
import { amazingGrace } from "@hearth/songs/fixtures";
import type { WholeSong } from "@hearth/songs";
import { DEFAULT_ARRANGEMENT_NAME } from "../src/main/songs";
import { restoredOrders } from "../src/main/repair";

/** The song as the old save path left it: one order, every section once. */
function damaged(): WholeSong {
  return {
    ...amazingGrace,
    arrangements: [
      {
        id: "song-amazing-grace:arrangement:1",
        songId: "song-amazing-grace",
        name: DEFAULT_ARRANGEMENT_NAME,
        key: "G",
        tempoBpm: null,
        sequence: amazingGrace.sections.map((section) => section.label),
        chordpro: null,
        isDefault: true,
      },
    ],
  };
}

describe("putting the wiped orders back", () => {
  it("restores the ones the sample service names", () => {
    const fixed = restoredOrders(damaged(), amazingGrace);
    expect(fixed?.arrangements.map((one) => one.id)).toEqual([
      "song-amazing-grace:arrangement:1",
      "ag-standard",
      "ag-short",
    ]);
  });

  it("leaves the church on the order it was on", () => {
    const fixed = restoredOrders(damaged(), amazingGrace);
    const defaults = fixed?.arrangements.filter((one) => one.isDefault) ?? [];
    expect(defaults.map((one) => one.name)).toEqual([DEFAULT_ARRANGEMENT_NAME]);
  });

  it("does nothing to a library that still has them", () => {
    expect(restoredOrders(amazingGrace, amazingGrace)).toBeNull();
  });

  it("does nothing where somebody has made their own", () => {
    const own = damaged();
    const only = own.arrangements[0];
    if (only === undefined) throw new Error("no order");
    own.arrangements.push({ ...only, id: "own", name: "Short", isDefault: false });
    expect(restoredOrders(own, amazingGrace)).toBeNull();
  });

  it("does nothing where the one order was renamed", () => {
    const renamed = damaged();
    const only = renamed.arrangements[0];
    if (only !== undefined) only.name = "Sunday";
    expect(restoredOrders(renamed, amazingGrace)).toBeNull();
  });

  it("leaves out an order the song can no longer sing", () => {
    const cut = damaged();
    cut.sections = cut.sections.filter((section) => section.label !== "V3");
    const fixed = restoredOrders(cut, amazingGrace);
    // Both sample orders name V3, so there is nothing left to put back.
    expect(fixed).toBeNull();
  });

  it("refuses a song that is not the one it was given", () => {
    expect(restoredOrders({ ...damaged(), song: { ...amazingGrace.song, id: "other" } }, amazingGrace))
      .toBeNull();
  });
});
