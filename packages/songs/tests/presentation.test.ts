/**
 * STG-145, ST2.16. Slides a person typed.
 *
 * The case this exists for is in docs/journeys.md, J1 step 4: somebody has
 * downloaded Stage and wants a title card, three notices and a sermon outline
 * on the screen. None of that is a song.
 */
import { describe, it, expect } from "vitest";
import {
  compileDeck,
  formatSlides,
  slideInputs,
  slidesFrom,
  lookupFrom,
  newPresentation,
  orderedSlides,
  parseSlides,
  presentationHasErrors,
  presentationPlan,
  presentationsFrom,
  slideCount,
  validatePresentation,
  type Presentation,
} from "../src/index";

const NOTICES = `[Title]
Morning Service
Everyone welcome

Church lunch
The 12th, after the service
Bring a dish

Youth group
Wednesdays, 7pm
The hall

Giving
There is a basket at the back`;

function typed(text: string, title = "Notices"): Presentation {
  return {
    ...newPresentation("p1", { title }),
    slides: parseSlides(text, { presentationId: "p1" }),
  };
}

describe("parsing typed slides", () => {
  it("breaks on a blank line, because that is where the person pressed return", () => {
    const slides = parseSlides(NOTICES, { presentationId: "p1" });
    expect(slides).toHaveLength(4);
    expect(slides[1]?.lines).toEqual([
      "Church lunch",
      "The 12th, after the service",
      "Bring a dish",
    ]);
  });

  it("takes a bracketed first line as the label and keeps it off the slide", () => {
    const slides = parseSlides(NOTICES, { presentationId: "p1" });
    expect(slides[0]?.label).toBe("Title");
    expect(slides[0]?.lines).toEqual(["Morning Service", "Everyone welcome"]);
    expect(slides[1]?.label).toBeNull();
  });

  it("treats a run of blank lines as one break", () => {
    const slides = parseSlides("One\n\n\n\n\nTwo", { presentationId: "p1" });
    expect(slides).toHaveLength(2);
  });

  it("drops trailing blank lines rather than making an empty slide", () => {
    const slides = parseSlides("One\nTwo\n\n\n", { presentationId: "p1" });
    expect(slides).toHaveLength(1);
  });

  it("accepts every line ending, because text arrives from a paste", () => {
    expect(parseSlides("One\r\n\r\nTwo", { presentationId: "p1" })).toHaveLength(2);
    expect(parseSlides("One\r\rTwo", { presentationId: "p1" })).toHaveLength(2);
  });

  it("numbers slides from zero, in the order typed", () => {
    const slides = parseSlides(NOTICES, { presentationId: "p1" });
    expect(slides.map((slide) => slide.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it("gives every slide an id tied to its presentation", () => {
    const slides = parseSlides("One\n\nTwo", { presentationId: "abc" });
    expect(slides.map((slide) => slide.id)).toEqual(["abc:slide:1", "abc:slide:2"]);
    expect(slides.every((slide) => slide.presentationId === "abc")).toBe(true);
  });

  it("never puts a newline inside a line, which is the R12.4 guard", () => {
    const slides = parseSlides(NOTICES, { presentationId: "p1" });
    for (const slide of slides) {
      for (const line of slide.lines) expect(line).not.toContain("\n");
    }
  });

  it("round trips through the text the editor loads", () => {
    const slides = parseSlides(NOTICES, { presentationId: "p1" });
    expect(formatSlides(slides)).toBe(NOTICES);
    expect(parseSlides(formatSlides(slides), { presentationId: "p1" })).toEqual(slides);
  });

  it("is empty for an empty box", () => {
    expect(parseSlides("", { presentationId: "p1" })).toEqual([]);
    expect(parseSlides("   \n\n  ", { presentationId: "p1" })).toEqual([]);
  });
});

describe("validating a presentation", () => {
  it("accepts the notices somebody typed", () => {
    expect(validatePresentation(typed(NOTICES))).toEqual([]);
  });

  it("refuses one with no title, because a library of untitled rows is unusable", () => {
    const problems = validatePresentation(typed(NOTICES, "  "));
    expect(problems).toEqual([{ code: "title.missing", severity: "error" }]);
    expect(presentationHasErrors(problems)).toBe(true);
  });

  it("accepts one named and not yet filled, because a title comes first", () => {
    const problems = validatePresentation(typed(""));
    expect(problems).toEqual([{ code: "slides.none", severity: "warning" }]);
    // The place an empty presentation has to be caught is the deck, where it is
    // reported by name before the service rather than found during it.
    expect(presentationHasErrors(problems)).toBe(false);
  });

  it("refuses a line holding a newline, however it got there", () => {
    const presentation = typed(NOTICES);
    (presentation.slides[0] as { lines: string[] }).lines = ["a\nb"];
    expect(validatePresentation(presentation).map((p) => p.code)).toContain(
      "slide.lines.containsNewline",
    );
  });

  it("refuses a slide belonging to another presentation", () => {
    const presentation = typed(NOTICES);
    (presentation.slides[2] as { presentationId: string }).presentationId = "elsewhere";
    expect(validatePresentation(presentation).map((p) => p.code)).toContain(
      "slide.presentation.mismatch",
    );
  });

  it("warns on a label that has become a sentence", () => {
    const presentation = typed(NOTICES);
    (presentation.slides[0] as { label: string }).label = "x".repeat(40);
    const problems = validatePresentation(presentation);
    expect(problems.map((p) => p.code)).toContain("slide.label.long");
    expect(presentationHasErrors(problems)).toBe(false);
  });
});

describe("slides from the boxes a person has on screen", () => {
  const BOXES = [
    { label: "Title", body: "Morning Service\nEveryone welcome" },
    { label: null, body: "Church lunch\nThe 12th, after the service" },
  ];

  it("takes one box as one slide, whatever is in it", () => {
    const slides = slidesFrom("p1", BOXES);
    expect(slides).toHaveLength(2);
    expect(slides[0]?.lines).toEqual(["Morning Service", "Everyone welcome"]);
    expect(slides[0]?.label).toBe("Title");
    expect(slides[1]?.label).toBeNull();
  });

  it("never splits a box on a blank line, because the person said where it ends", () => {
    const slides = slidesFrom("p1", [{ label: null, body: "One\n\n\nTwo" }]);
    expect(slides).toHaveLength(1);
    expect(slides[0]?.lines).toEqual(["One", "Two"]);
  });

  it("drops a box with nothing in it rather than storing a blank slide", () => {
    const slides = slidesFrom("p1", [...BOXES, { label: null, body: "   \n\n" }]);
    expect(slides).toHaveLength(2);
  });

  it("numbers what is left, so a dropped box leaves no gap", () => {
    const slides = slidesFrom("p1", [{ label: null, body: "" }, ...BOXES]);
    expect(slides.map((slide) => slide.sortOrder)).toEqual([0, 1]);
    expect(slides.map((slide) => slide.id)).toEqual(["p1:slide:1", "p1:slide:2"]);
  });

  it("treats a label of spaces as no label", () => {
    expect(slidesFrom("p1", [{ label: "   ", body: "One" }])[0]?.label).toBeNull();
  });

  it("never puts a newline inside a line, which is the R12.4 guard", () => {
    for (const slide of slidesFrom("p1", BOXES)) {
      for (const line of slide.lines) expect(line).not.toContain("\n");
    }
  });

  it("round trips through the boxes the editor shows", () => {
    const presentation = { ...newPresentation("p1", { title: "Notices" }), slides: slidesFrom("p1", BOXES) };
    expect(slideInputs(presentation)).toEqual(BOXES);
  });
});

describe("how many slides the room sees", () => {
  it("counts what was typed when every slide fits", () => {
    expect(slideCount(typed(NOTICES))).toBe(4);
  });

  it("counts a slide typed too long for the screen as the slides it becomes", () => {
    const long = typed("One\nTwo\nThree\nFour\nFive\nSix");
    expect(long.slides).toHaveLength(1);
    expect(slideCount(long, { maxLines: 3 })).toBe(2);
  });

  it("counts a slide holding a gap as one, because a gap is not a break", () => {
    const presentation = {
      ...newPresentation("p1", { title: "Notices" }),
      slides: slidesFrom("p1", [{ label: null, body: "One\n\nTwo" }]),
    };
    expect(slideCount(presentation)).toBe(1);
  });

  it("orders slides by what they say rather than by storage order", () => {
    const presentation = typed(NOTICES);
    presentation.slides.reverse();
    expect(orderedSlides(presentation)[0]?.label).toBe("Title");
  });
});

describe("presenting one on its own", () => {
  const presentation = typed(NOTICES);

  it("compiles to a deck of cues with no song in it", () => {
    const plan = presentationPlan(presentation, { date: "2026-10-04" });
    const deck = compileDeck(plan, lookupFrom([]), {
      presentations: presentationsFrom([presentation]),
    });

    expect(deck.problems).toEqual([]);
    expect(deck.cues).toHaveLength(4);
    expect(deck.cues.every((cue) => cue.kind === "slide")).toBe(true);
    expect(deck.cues[0]?.lines).toEqual(["Morning Service", "Everyone welcome"]);
    expect(deck.groups[0]?.title).toBe("Notices");
  });

  it("carries the author's label onto the cue, for the operator", () => {
    const plan = presentationPlan(presentation);
    const deck = compileDeck(plan, lookupFrom([]), {
      presentations: presentationsFrom([presentation]),
    });
    expect(deck.cues[0]?.label).toBe("Title");
    expect(deck.cues[1]?.label).toBeNull();
  });

  it("keeps a slide holding a gap as one cue", () => {
    const presentation = {
      ...newPresentation("p1", { title: "Notices" }),
      slides: slidesFrom("p1", [{ label: null, body: "One\n\nTwo" }]),
    };
    const deck = compileDeck(presentationPlan(presentation), lookupFrom([]), {
      presentations: presentationsFrom([presentation]),
    });
    expect(deck.cues).toHaveLength(1);
    expect(deck.cues[0]?.lines).toEqual(["One", "Two"]);
  });

  it("splits a slide too long for the screen and keeps its label on both halves", () => {
    const long = typed("[Point 2]\nOne\nTwo\nThree\nFour");
    const deck = compileDeck(presentationPlan(long), lookupFrom([]), {
      presentations: presentationsFrom([long]),
      limits: { maxLines: 2 },
    });
    expect(deck.cues).toHaveLength(2);
    expect(deck.cues.map((cue) => cue.label)).toEqual(["Point 2", "Point 2"]);
    expect(deck.cues.map((cue) => cue.slideIndex)).toEqual([0, 1]);
  });

  it("sizes each typed slide on its own, so a title is not shrunk to fit an outline", () => {
    const deck = compileDeck(presentationPlan(presentation), lookupFrom([]), {
      presentations: presentationsFrom([presentation]),
    });
    const groups = new Set(deck.cues.map((cue) => cue.fitGroup));
    expect(groups.size).toBe(4);
  });

  it("sizes the halves of one typed slide together", () => {
    const long = typed("One\nTwo\nThree\nFour");
    const deck = compileDeck(presentationPlan(long), lookupFrom([]), {
      presentations: presentationsFrom([long]),
      limits: { maxLines: 2 },
    });
    expect(new Set(deck.cues.map((cue) => cue.fitGroup)).size).toBe(1);
  });

  it("reports a presentation the library does not have, at compile time", () => {
    const plan = presentationPlan(presentation);
    const deck = compileDeck(plan, lookupFrom([]), { presentations: presentationsFrom([]) });
    expect(deck.cues).toEqual([]);
    expect(deck.problems).toEqual([
      {
        code: "item.presentation.missing",
        itemId: "item:p1",
        presentationId: "p1",
        title: "Notices",
      },
    ]);
  });

  it("reports one with no lookup at all rather than throwing", () => {
    const deck = compileDeck(presentationPlan(presentation), lookupFrom([]));
    expect(deck.problems.map((problem) => problem.code)).toEqual(["item.presentation.missing"]);
  });

  it("keeps cue ids stable across a recompile, so a restart lands on the same slide", () => {
    const plan = presentationPlan(presentation);
    const first = compileDeck(plan, lookupFrom([]), {
      presentations: presentationsFrom([presentation]),
    });
    const again = compileDeck(plan, lookupFrom([]), {
      presentations: presentationsFrom([presentation]),
    });
    expect(again.cues.map((cue) => cue.id)).toEqual(first.cues.map((cue) => cue.id));
  });
});
