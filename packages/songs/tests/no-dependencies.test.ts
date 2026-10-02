/**
 * STG-1. The guard on the package's one architectural rule.
 *
 * `@hearth/songs` is imported by a Next.js server action, an Electron main
 * process, a worker thread reading a ProPresenter file, and a test. Anything it
 * depends on, all four have to carry, so it depends on nothing.
 *
 * Stated as a test rather than as a README line, because a README does not fail
 * a build and somebody will reach for a validation library eventually.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath rather than URL.pathname, which percent-encodes a space in the
// checkout path and sends readdir looking for a directory nobody has.
const root = fileURLToPath(new URL("..", import.meta.url));

function sourceFiles(): string[] {
  const dir = join(root, "src");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => join(dir, name));
}

describe("no runtime dependencies", () => {
  it("declares none in package.json", () => {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(manifest.dependencies ?? {}).toEqual({});
  });

  it("imports nothing but its own files", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/^\s*(?:import|export)[^;]*?from\s+"([^"]+)"/gm)) {
        const specifier = match[1];
        if (specifier !== undefined && !specifier.startsWith(".")) {
          offenders.push(`${file.split("/").pop() ?? file} imports ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("holds no reference to a database, a framework or a store", () => {
    // The list is the set of mistakes that would be easy to make here, each one
    // of which would stop one of the four callers from using this package.
    const banned = ["drizzle", "postgres", "better-sqlite3", "next/", "react", "electron"];
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(file, "utf8").toLowerCase();
      for (const term of banned) {
        if (source.includes(`"${term}`) || source.includes(`from "${term}`)) {
          offenders.push(`${file.split("/").pop() ?? file} mentions ${term}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
