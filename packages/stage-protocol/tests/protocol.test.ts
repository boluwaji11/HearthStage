/**
 * STG-12.
 *
 * Every intent crosses a sandbox boundary, so it is validated on arrival rather
 * than trusted. These are the cases a renderer bug or a malformed message would
 * produce.
 */
import { describe, it, expect } from "vitest";
import { ALL_CHANNELS, CHANNELS, isBlank, isChannel, isIntent } from "../src/index";

describe("isIntent", () => {
  it("accepts the intents a window can send", () => {
    const good: unknown[] = [
      { type: "advance" },
      { type: "reverse" },
      { type: "reload" },
      { type: "goTo", position: 0 },
      { type: "goTo", position: 41 },
      { type: "goToCue", cueId: "group:item-holy:V1:1:0" },
      { type: "setBlank", blank: "black" },
      { type: "toggleBlank", blank: "logo" },
    ];
    for (const intent of good) expect(isIntent(intent), JSON.stringify(intent)).toBe(true);
  });

  it("refuses what is not one", () => {
    const bad: unknown[] = [
      null,
      undefined,
      "advance",
      42,
      [],
      {},
      { type: "quit" },
      { type: "goTo" },
      { type: "goTo", position: -1 },
      { type: "goTo", position: 1.5 },
      { type: "goTo", position: "3" },
      { type: "goToCue" },
      { type: "goToCue", cueId: "" },
      { type: "setBlank" },
      { type: "setBlank", blank: "invisible" },
      { type: "toggleBlank", blank: null },
    ];
    for (const intent of bad) expect(isIntent(intent), JSON.stringify(intent)).toBe(false);
  });

  it("ignores a property it does not know about", () => {
    // A renderer from a newer build sending a field this one has never heard of
    // should still be able to advance a slide.
    expect(isIntent({ type: "advance", sentAt: 1_760_000_000 })).toBe(true);
    expect(isIntent({ type: "goTo", position: 2, smooth: true })).toBe(true);
  });

  it("refuses a prototype-polluting payload", () => {
    expect(isIntent(JSON.parse('{"__proto__":{"type":"advance"}}'))).toBe(false);
  });
});

describe("channels", () => {
  it("is an allowlist, so a renderer cannot name one that is not on it", () => {
    for (const channel of ALL_CHANNELS) expect(isChannel(channel)).toBe(true);
    for (const other of ["ipc", "hearth:", "hearth:anything", "", "__proto__"]) {
      expect(isChannel(other), other).toBe(false);
    }
  });

  it("names four, and they all start with the product", () => {
    expect(ALL_CHANNELS).toHaveLength(4);
    expect(ALL_CHANNELS.every((channel) => channel.startsWith("hearth:"))).toBe(true);
    expect(CHANNELS.intent).toBe("hearth:intent");
  });
});

describe("isBlank", () => {
  it("knows the four", () => {
    for (const blank of ["none", "black", "clear", "logo"]) expect(isBlank(blank)).toBe(true);
    for (const other of ["blank", "", null, 0]) expect(isBlank(other)).toBe(false);
  });
});
