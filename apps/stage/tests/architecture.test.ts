/**
 * STG-31, ST21.8.
 *
 * **No network call in the render path.** Enforced by a test rather than by
 * discipline, because the person who adds one will have a good reason and will
 * be in a hurry.
 *
 * The render path is the output renderer and the fitting it depends on. A
 * network call there would put the building's wifi between a keypress and a
 * pixel, which is the one thing Stage exists to avoid.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function filesUnder(directory: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else if (/\.(ts|js|mjs|css|html)$/.test(name)) found.push(path);
  }
  return found;
}

/** What a renderer must never reach for. */
const NETWORK = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /\bnavigator\.sendBeacon\b/,
  /\bimport\s*\(\s*["']https?:/,
  /from\s+["']https?:/,
  /\brequire\s*\(\s*["']node:(http|https|net|dgram|tls)["']/,
  /from\s+["']node:(http|https|net|dgram|tls)["']/,
];

describe("the render path", () => {
  const renderPath = [join(root, "src/output")];

  it("reaches for nothing on the network", () => {
    const offenders: string[] = [];
    for (const directory of renderPath) {
      for (const file of filesUnder(directory)) {
        const source = readFileSync(file, "utf8");
        for (const pattern of NETWORK) {
          if (pattern.test(source)) {
            offenders.push(`${file.replace(root, "")} matches ${pattern}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("loads nothing from a remote origin", () => {
    // A font or a stylesheet from a CDN is a network call that only fails on
    // the one service the wifi is down.
    for (const directory of renderPath) {
      for (const file of filesUnder(directory)) {
        const source = readFileSync(file, "utf8");
        expect(source, file).not.toMatch(/https?:\/\//);
      }
    }
  });

  it("declares a content security policy with no remote origins", () => {
    for (const page of ["src/output/index.html", "src/control/index.html"]) {
      const source = readFileSync(join(root, page), "utf8");
      expect(source, page).toContain("Content-Security-Policy");
      expect(source, page).toContain("default-src 'none'");
      // Every source is 'self' or a data URI. A remote origin here would make
      // the sandbox decorative.
      const policy = /content="([^"]+)"/.exec(source)?.[1] ?? "";
      expect(policy, page).not.toMatch(/https?:/);
    }
  });
});

describe("the renderers", () => {
  it("hold no Electron import, because they are sandboxed", () => {
    for (const directory of [join(root, "src/output"), join(root, "src/control")]) {
      for (const file of filesUnder(directory)) {
        const source = readFileSync(file, "utf8");
        expect(source, file).not.toMatch(/from\s+["']electron["']/);
        expect(source, file).not.toMatch(/require\s*\(\s*["']electron["']/);
      }
    }
  });

  it("reach the application only through the preload bridge", () => {
    // `window.hearth` is the whole surface. Anything else would mean a channel
    // nobody put on the allowlist.
    for (const directory of [join(root, "src/output"), join(root, "src/control")]) {
      for (const file of filesUnder(directory).filter((name) => name.endsWith(".ts"))) {
        const source = readFileSync(file, "utf8");
        expect(source, file).not.toMatch(/\bipcRenderer\b/);
        expect(source, file).not.toMatch(/\bnode:fs\b/);
      }
    }
  });
});

describe("the main process", () => {
  it("validates every intent on arrival rather than trusting it", () => {
    const source = readFileSync(join(root, "src/main/index.ts"), "utf8");
    expect(source).toContain("isIntent");
  });

  it("keeps node integration off and the sandbox on for every window", () => {
    const source = readFileSync(join(root, "src/main/windows.ts"), "utf8");
    expect(source).toMatch(/sandbox:\s*true/);
    expect(source).toMatch(/contextIsolation:\s*true/);
    expect(source).toMatch(/nodeIntegration:\s*false/);
  });
});
