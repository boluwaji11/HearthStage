/**
 * STG-30, ST20.1, ST20.2. The control surface, audited to WCAG 2.2 AA in CI.
 *
 * Run against the real window rather than against the markup, because half of
 * what this has to catch is computed: contrast is a colour over a colour after
 * the theme tokens resolve, and a name is whatever `fillText` put there. A
 * jsdom audit would pass a window nobody can read.
 *
 * Every state is audited, because a surface is accessible in the state it is
 * in and the one a volunteer meets at 10:28 is the one with a service running.
 *
 *   pnpm --filter @hearth/stage build && pnpm --filter @hearth/stage a11y
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electron = require("electron");
const here = dirname(fileURLToPath(import.meta.url));
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

/**
 * WCAG 2.2 AA, which is the bar the platform holds (R22.7).
 *
 * `best-practice` is left out on purpose: it is advice rather than the
 * standard, and a rule nobody agreed to is a rule that gets disabled in a hurry
 * the first time it fails a release.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const PORT = 9300 + Math.floor(Math.random() * 600);
const data = mkdtempSync(join(tmpdir(), "hearth-audit-"));
const env = { ...process.env };
delete env["ELECTRON_RUN_AS_NODE"];

const app = spawn(
  electron,
  [resolve(here, ".."), `--remote-debugging-port=${PORT}`, `--user-data-dir=${data}`],
  { stdio: ["ignore", "pipe", "pipe"], env },
);
let noise = "";
app.stdout.on("data", (chunk) => (noise += chunk));
app.stderr.on("data", (chunk) => (noise += chunk));

function stop(code) {
  app.kill();
  rmSync(data, { recursive: true, force: true });
  process.exit(code);
}

async function targets() {
  for (let tries = 0; tries < 60; tries += 1) {
    try {
      const answer = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await answer.json();
      if (list.some((one) => one.url.includes("control/index.html"))) return list;
    } catch {
      // Not up yet.
    }
    await new Promise((settle) => setTimeout(settle, 250));
  }
  throw new Error("The application never opened its debugging port.");
}

function connect(url) {
  const socket = new WebSocket(url);
  const waiting = new Map();
  let next = 1;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      waiting.get(message.id)?.(message);
      waiting.delete(message.id);
    }
  });
  return {
    open: new Promise((settle) => socket.addEventListener("open", settle)),
    send(method, params = {}) {
      const id = next++;
      return new Promise((settle) => {
        waiting.set(id, settle);
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

const list = await targets();
const at = list.find((one) => one.url.includes("control/index.html"));
const control = connect(at.webSocketDebuggerUrl);
await control.open;
await control.send("Runtime.enable");

async function run(expression, awaitPromise = false) {
  const answer = await control.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise,
  });
  const thrown = answer.result?.exceptionDetails;
  if (thrown !== undefined) throw new Error(JSON.stringify(thrown.exception ?? thrown));
  return answer.result?.result?.value;
}

const pause = (ms) => new Promise((settle) => setTimeout(settle, ms));

await pause(1500);
await run(AXE);

/** One state of the surface, named so a failure says where to look. */
async function audit(name) {
  const result = await run(
    `axe.run(document, { runOnly: { type: "tag", values: ${JSON.stringify(TAGS)} } })
       .then((r) => ({
         violations: r.violations.map((v) => ({
           id: v.id,
           impact: v.impact,
           help: v.help,
           nodes: v.nodes.slice(0, 4).map((n) => ({ target: n.target.join(" "), summary: n.failureSummary })),
         })),
         passes: r.passes.length,
       }))`,
    true,
  );
  const count = result.violations.length;
  console.log(`${count === 0 ? "ok  " : "FAIL"}  ${name}: ${result.passes} rules passed, ${count} violations`);
  for (const one of result.violations) {
    console.log(`        ${one.id} (${one.impact}): ${one.help}`);
    for (const node of one.nodes) console.log(`          ${node.target}`);
  }
  return result.violations;
}

const found = [];
const state = async (name, setUp, settle = 600) => {
  if (setUp !== null) await run(setUp);
  await pause(settle);
  const violations = await audit(name);
  if (violations.length > 0) found.push(name);
};

await state("the landing page", null);
await state("the library, choosing a kind", `document.getElementById("way-library").click()`);
await state("the library, songs", `document.getElementById("kind-song").click()`);
await state(
  "the library with hymns in it",
  `(() => { const b = document.getElementById("add-samples"); if (b && !b.hidden) b.click(); })()`,
  2500,
);
await state("this machine", `document.getElementById("library-back").click(); document.getElementById("library-back").click(); document.getElementById("way-settings").click()`);
await state("the presentation plans, empty", `document.getElementById("settings-back").click(); document.getElementById("way-plans").click()`);
await state("one presentation plan, open", `document.getElementById("plan-create").click()`, 900);
await state(
  "adding from the library",
  `document.getElementById("plan-name").value = "Morning Service";
   document.getElementById("plan-name").dispatchEvent(new Event("input"));
   document.getElementById("plan-name").dispatchEvent(new Event("blur"));
   document.getElementById("entry-add").click()`,
  900,
);
await state(
  "a service running",
  `(() => { const b = document.querySelector("#pick-list button"); if (b) b.click(); })();
   document.getElementById("pick-close").click();
   document.getElementById("plan-present").click()`,
  1400,
);
await state("the shortcuts card", `document.getElementById("brief-open").click()`);
await state("the countdown card", `document.getElementById("brief-close").click(); document.getElementById("countdown-open").click()`);
await state("adding a song called from the floor", `document.getElementById("countdown-close").click(); document.getElementById("call-open").click()`);
await state("correcting a typo on the wall", `document.getElementById("call-close").click(); document.getElementById("fix-open").click()`);
await state("going to a cue by label", `document.getElementById("fix-close").click(); document.getElementById("jump-open").click()`);
await state("a slide being typed", `document.getElementById("jump-close").click(); document.getElementById("home").click(); document.getElementById("way-library").click(); document.getElementById("kind-song").click(); document.querySelector("#tiles button")?.click()`, 1200);

/**
 * ST20.2, which no automated rule covers: the focus ring is never removed.
 *
 * axe cannot see a ring that was styled away, so the stylesheets are read. An
 * outline of none is allowed only where the rule that follows puts one back.
 */
const styles = ["src/control/control.css", "src/editor/editor.css", "src/output/output.css"];
for (const file of styles) {
  const css = readFileSync(resolve(here, "..", file), "utf8");
  const removed = [...css.matchAll(/:focus(-visible)?[^{]*\{[^}]*outline:\s*(none|0)/g)];
  if (removed.length > 0) {
    console.log(`FAIL  ${file}: the focus ring is styled away`);
    found.push(file);
  }
}
console.log(`ok    the focus ring is never removed (${styles.length} stylesheets)`);

const errors = noise.split("\n").filter((line) => /Uncaught|SecurityError/i.test(line));
if (errors.length > 0) {
  console.log("FAIL  errors on the console");
  console.log(errors.slice(0, 6).join("\n"));
  found.push("console");
}

console.log(found.length === 0 ? "\nWCAG 2.2 AA, clean." : `\nFAILED in: ${found.join(", ")}`);
stop(found.length === 0 ? 0 : 1);
