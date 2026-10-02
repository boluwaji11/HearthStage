/**
 * STG-168, ST19.5.
 *
 * For an unpaired church, the data directory holds the only copy of everything
 * they typed. Moving it is the kind of one-line change that quietly loses a
 * library, so the decision is a function with no filesystem in it and every
 * refusal has a test.
 */
import { describe, it, expect } from "vitest";
import { APP_NAME, LIBRARY_ENTRIES, OLD_FOLDER, relocation } from "../src/main/userdata";

const OLD = "/data/@hearth/stage";
const NEW = "/data/Hearth Stage";

/** Names present in each directory. */
function facts(present: Record<string, string[]>, from = OLD, to = NEW) {
  return {
    from,
    to,
    has: (directory: string, name: string) => (present[directory] ?? []).includes(name),
  };
}

describe("where the library lives", () => {
  it("is a name a person would recognise in a support call", () => {
    expect(APP_NAME).toBe("Hearth Stage");
    expect(OLD_FOLDER).toBe("@hearth/stage");
  });

  it("moves the library, what SQLite keeps beside it, and the backups", () => {
    const what = relocation(
      facts({ [OLD]: ["library.db", "library.db-wal", "library.db-shm", "backups"] }),
    );
    expect(what.action).toBe("move");
    expect(what.entries).toEqual([...LIBRARY_ENTRIES]);
  });

  it("carries only what is there, so a missing write-ahead log is no problem", () => {
    const what = relocation(facts({ [OLD]: ["library.db"] }));
    expect(what.entries).toEqual(["library.db"]);
  });

  it("asks about the library rather than about the directory", () => {
    // Chromium makes the new data directory for its own caches before any of
    // this runs. A rule that asked whether the directory existed found that it
    // always did, and moved nothing.
    const what = relocation(
      facts({ [OLD]: ["library.db"], [NEW]: ["Cache", "Preferences", "GPUCache"] }),
    );
    expect(what.action).toBe("move");
  });

  it("does nothing on a fresh install", () => {
    expect(relocation(facts({})).reason).toBe("nothing-to-move");
  });

  it("does nothing on a second launch, because the old files have gone", () => {
    expect(relocation(facts({ [NEW]: ["library.db"] })).reason).toBe("nothing-to-move");
  });

  it("refuses when both hold a library, because a move would throw one away", () => {
    const what = relocation(facts({ [OLD]: ["library.db"], [NEW]: ["library.db"] }));
    expect(what).toEqual({ action: "none", reason: "already-there", entries: [] });
  });

  it("refuses when the two paths are the same", () => {
    expect(relocation(facts({ [NEW]: ["library.db"] }, NEW, NEW)).reason).toBe("same-place");
  });
});
