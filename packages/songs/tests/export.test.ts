/**
 * STG-54, ST2.12. The doors out.
 *
 * A church leaving Stage takes its library. OpenLyrics is the door another
 * presenter can read, and the bundle is the door that loses nothing. Both are
 * ungated, so what matters here is that they are correct and stable: a church
 * only finds out an export was wrong at the moment it has nothing else.
 */
import { describe, it, expect } from "vitest";
import { amazingGrace, blankWholeSong, blankSection } from "../src/fixtures";
import { toOpenLyrics, fileNameFor } from "../src/openlyrics";
import { toBundle, bundleJson, readBundle, BUNDLE_SCHEMA } from "../src/bundle";
import type { WholeSong } from "../src/types";

describe("a song as OpenLyrics", () => {
  const xml = toOpenLyrics(amazingGrace, { at: "2026-10-01T09:00:00Z" });

  it("declares the format and the version a reader checks", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns="http://openlyrics.info/namespace/2009/song"');
    expect(xml).toContain('version="0.9"');
  });

  it("carries the title and who wrote it", () => {
    expect(xml).toContain(`<title>${amazingGrace.song.title}</title>`);
  });

  it("names each section the way OpenLyrics names them", () => {
    expect(xml).toMatch(/<verse name="v1">/);
  });

  it("keeps a line break between lines rather than running them together", () => {
    expect(xml).toContain("<br/>");
  });

  it("writes the order the church sings it in", () => {
    const order = /<verseOrder>([^<]*)<\/verseOrder>/.exec(xml)?.[1] ?? "";
    expect(order.split(" ").length).toBeGreaterThan(1);
    expect(order).toMatch(/^[a-z]/);
  });

  it("says public domain where the song is", () => {
    const hymn: WholeSong = {
      ...amazingGrace,
      song: { ...amazingGrace.song, isPublicDomain: true, copyrightLine: null },
    };
    expect(toOpenLyrics(hymn)).toContain("<copyright>Public Domain</copyright>");
  });

  it("leaves out a property the song does not have", () => {
    const bare: WholeSong = {
      ...amazingGrace,
      song: { ...amazingGrace.song, publisher: null, ccliNumber: null },
    };
    const written = toOpenLyrics(bare);
    expect(written).not.toContain("<publisher>");
    expect(written).not.toContain("<ccliNo>");
  });

  it("escapes what would otherwise close an element", () => {
    const awkward = blankWholeSong({
      song: { ...blankWholeSong().song, title: 'Grace & Peace <to> "all"' },
      sections: [blankSection({ lines: ["Praise & honour", "<not a tag>"] })],
    });
    const written = toOpenLyrics(awkward);
    expect(written).toContain("Grace &amp; Peace &lt;to&gt; &quot;all&quot;");
    expect(written).toContain("Praise &amp; honour");
    expect(written).toContain("&lt;not a tag&gt;");
    expect(written).not.toMatch(/<not a tag>/);
  });

  it("writes the same bytes twice, so a church sees only what changed", () => {
    expect(toOpenLyrics(amazingGrace, { at: "2026-10-01T09:00:00Z" })).toBe(xml);
  });
});

describe("the file a song is written to", () => {
  it("is named after the song", () => {
    expect(fileNameFor(amazingGrace)).toContain(amazingGrace.song.title);
    expect(fileNameFor(amazingGrace).endsWith(".xml")).toBe(true);
  });

  it("drops what Windows refuses, so the folder opens there too", () => {
    const awkward = blankWholeSong({
      song: { ...blankWholeSong().song, id: "s1", title: 'Who/What: "Why?" <Lord>' },
    });
    expect(fileNameFor(awkward)).toBe("Who What Why Lord (s1).xml");
  });

  it("carries the id, so two songs of one name cannot collide", () => {
    const one = blankWholeSong({ song: { ...blankWholeSong().song, id: "a", title: "Alleluia" } });
    const other = blankWholeSong({ song: { ...blankWholeSong().song, id: "b", title: "Alleluia" } });
    expect(fileNameFor(one)).not.toBe(fileNameFor(other));
  });

  it("gives a nameless song a name rather than a bare extension", () => {
    const nameless = blankWholeSong({ song: { ...blankWholeSong().song, id: "s", title: "" } });
    expect(fileNameFor(nameless)).toBe("song (s).xml");
  });
});

describe("the whole library as one file", () => {
  const bundle = toBundle({ songs: [amazingGrace] }, "2026-10-01T09:00:00Z");

  it("says which schema it is, so a reader can refuse what it cannot read", () => {
    expect(bundle.schema).toBe(BUNDLE_SCHEMA);
  });

  it("holds the songs whole", () => {
    expect(bundle.songs[0]?.sections.length).toBe(amazingGrace.sections.length);
    expect(bundle.songs[0]?.arrangements.length).toBe(amazingGrace.arrangements.length);
  });

  it("writes the same bytes twice", () => {
    const again = toBundle({ songs: [amazingGrace] }, "2026-10-01T09:00:00Z");
    expect(bundleJson(again)).toBe(bundleJson(bundle));
  });

  it("sorts by id, so the order a store happened to return does not show", () => {
    const one = blankWholeSong({ song: { ...blankWholeSong().song, id: "b" } });
    const other = blankWholeSong({ song: { ...blankWholeSong().song, id: "a" } });
    expect(toBundle({ songs: [one, other] }, "x").songs.map((s) => s.song.id)).toEqual(["a", "b"]);
  });

  it("comes back the way it went in", () => {
    const read = readBundle(bundleJson(bundle));
    expect("bundle" in read && read.bundle.songs[0]?.song.title).toBe(amazingGrace.song.title);
  });

  it("refuses a file that is not a bundle", () => {
    expect(readBundle("not json")).toEqual({ problem: "not an object" });
    expect(readBundle("[1,2,3]")).toEqual({ problem: "not an object" });
    expect(readBundle('{"songs":[]}')).toEqual({ problem: "no schema" });
  });

  it("refuses a bundle from a newer Stage rather than reading half of it", () => {
    const newer = bundleJson({ ...bundle, schema: BUNDLE_SCHEMA + 1 });
    expect(readBundle(newer)).toEqual({ problem: "newer schema" });
  });
});
