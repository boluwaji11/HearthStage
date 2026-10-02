/**
 * STG-26, ST5.10. A clock on the wall before a service starts.
 *
 * The case is a room filling up at twenty to, with nothing open yet, and a
 * church that wants the screen to say how long is left. So it has to work over
 * an empty deck, and it has to come off again without disturbing whatever is
 * underneath.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { compileDeck, lookupFrom, type Deck, type ServicePlan } from "@hearth/songs";
import { sampleLibrary, sampleService } from "@hearth/songs/fixtures";
import { Session } from "../src/main/session";
import { remaining } from "../src/output/slide";

const NOTHING: ServicePlan = {
  id: "nothing",
  source: "set_list",
  title: "",
  date: "",
  startsAt: null,
  items: [],
};

let deck: Deck;
let session: Session;
let clock: number;

beforeEach(() => {
  clock = 1_700_000_000_000;
  deck = compileDeck(sampleService, lookupFrom(sampleLibrary));
  session = new Session(deck, sampleService, { now: () => clock });
});

describe("putting a clock up", () => {
  it("names the moment it reaches rather than the seconds left", () => {
    expect(session.apply({ type: "startCountdown", minutes: 5 })).toBe(true);
    const content = session.outputState("out").content;
    expect(content.kind).toBe("countdown");
    expect(content.kind === "countdown" && content.endsAt).toBe(clock + 5 * 60_000);
  });

  it("works with no service open at all, which is when a church wants one", () => {
    const empty = new Session(compileDeck(NOTHING, lookupFrom([])), null, { now: () => clock });
    expect(empty.apply({ type: "startCountdown", minutes: 10 })).toBe(true);
    expect(empty.outputState("out").content.kind).toBe("countdown");
  });

  it("covers what is live without moving it", () => {
    session.apply({ type: "goTo", position: 3 });
    const live = session.liveCueId();
    session.apply({ type: "startCountdown", minutes: 5 });
    expect(session.liveCueId()).toBe(live);

    session.apply({ type: "stopCountdown" });
    expect(session.outputState("out").content.kind).not.toBe("countdown");
    expect(session.liveCueId()).toBe(live);
  });

  it("shows the operator the same clock the room is looking at", () => {
    session.apply({ type: "startCountdown", minutes: 5 });
    const state = session.controlState([]);
    expect(state.live?.content.kind).toBe("countdown");
    expect(state.countdownEndsAt).toBe(clock + 5 * 60_000);
  });

  it("starts again from the new time when it is pressed twice", () => {
    session.apply({ type: "startCountdown", minutes: 5 });
    clock += 60_000;
    session.apply({ type: "startCountdown", minutes: 15 });
    expect(session.controlState([]).countdownEndsAt).toBe(clock + 15 * 60_000);
  });

  it("says nothing changed when there was no clock to stop", () => {
    expect(session.apply({ type: "stopCountdown" })).toBe(false);
  });
});

describe("the time a room reads", () => {
  const at = 1_700_000_000_000;

  it("is minutes and seconds", () => {
    expect(remaining(at + 5 * 60_000, at)).toBe("5:00");
    expect(remaining(at + 59_000, at)).toBe("0:59");
    expect(remaining(at + 61_000, at)).toBe("1:01");
  });

  it("shows hours only once there is an hour to show", () => {
    expect(remaining(at + 59 * 60_000, at)).toBe("59:00");
    expect(remaining(at + 61 * 60_000, at)).toBe("1:01:00");
  });

  it("stops at zero rather than counting how late a service is", () => {
    expect(remaining(at, at)).toBe("0:00");
    expect(remaining(at - 90_000, at)).toBe("0:00");
  });

  it("rounds up, so a clock reads 5:00 for a moment rather than 4:59", () => {
    expect(remaining(at + 5 * 60_000 - 1, at)).toBe("5:00");
  });
});
