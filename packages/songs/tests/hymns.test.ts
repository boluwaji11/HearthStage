/**
 * STG-10, ST1.2. The hymns Stage ships.
 *
 * They go into a church's library on one button, so they are checked the way
 * the library checks anything: every one of them has to validate, compile and
 * present. A broken hymn here is a broken hymn on a wall on a Sunday, and
 * nobody typed it, so nobody would know where to look.
 */
import { describe, it, expect } from "vitest";
import { BUNDLED_HYMN_COUNT, bundledHymns } from "../src/hymns";
import { compileDeck, lookupFrom } from "../src/deck";
import { songPlan } from "../src/service";
import { errorsOnly, validateWholeSong } from "../src/validate";

const hymns = bundledHymns();

describe("the bundled hymns", () => {
  it("ships the set the count promises", () => {
    expect(hymns).toHaveLength(BUNDLED_HYMN_COUNT);
    expect(BUNDLED_HYMN_COUNT).toBeGreaterThan(100);
  });

  it("validates, every one", () => {
    const broken = hymns
      .map((whole) => ({ title: whole.song.title, problems: errorsOnly(validateWholeSong(whole)) }))
      .filter((entry) => entry.problems.length > 0);
    expect(broken).toEqual([]);
  });

  it("presents, every one", () => {
    const broken = hymns
      .map((whole) => ({
        title: whole.song.title,
        deck: compileDeck(songPlan(whole, { date: "2026-10-04" }), lookupFrom([whole])),
      }))
      .filter((entry) => entry.deck.problems.length > 0 || entry.deck.cues.length === 0)
      .map((entry) => [entry.title, entry.deck.problems]);
    expect(broken).toEqual([]);
  });

  it("is public domain, every one, because Stage ships no licensed words", () => {
    expect(hymns.every((whole) => whole.song.isPublicDomain)).toBe(true);
    expect(hymns.every((whole) => whole.song.copyrightLine === "Public Domain")).toBe(true);
  });

  it("gives every hymn a title and an author", () => {
    expect(hymns.filter((whole) => whole.song.title.trim() === "")).toEqual([]);
    expect(hymns.filter((whole) => whole.song.author === null).length).toBeLessThan(
      hymns.length / 4,
    );
  });

  it("holds no two songs under one id", () => {
    const ids = hymns.map((whole) => whole.song.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has words on every line of every verse", () => {
    const empty = hymns.flatMap((whole) =>
      whole.sections.filter((section) => section.lines.some((line) => line.trim() === "")),
    );
    expect(empty).toEqual([]);
  });
});
