/**
 * STG-29, ST21.1, ST21.5. How long a keypress takes to reach the wall.
 *
 *   pnpm --filter @hearth/stage latency
 *
 * The budget is 100ms at the 99th percentile, from the key event to pixels
 * changed on the output, measured by frame capture. That is the one number this
 * product lives or dies by: a church will forgive a plain theme and will not
 * forgive a slide that arrives after the congregation has started singing.
 *
 * **It drives the real application.** The built app is launched with the
 * debugging port open and spoken to over the DevTools protocol: a real key
 * event into the control window, and `Page.startScreencast` on the output
 * window, which emits a frame when and only when something was painted. The
 * first frame after the key is the moment the room saw it. Nothing is
 * instrumented, so there is no code path here that a church does not run.
 *
 * **It runs against a scratch library** in a temporary folder, so measuring
 * cannot touch what a church typed.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, totalmem, tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electron = require("electron");
const here = dirname(fileURLToPath(import.meta.url));

// A port of its own per run. A fixed one is a run that fails because the last
// application has not finished closing.
const PORT = 9300 + Math.floor(Math.random() * 600);
const ROUNDS = Number(process.argv[2] ?? 60);
/** ST21.1, at the 99th percentile. */
const BUDGET_MS = 100;

const data = mkdtempSync(join(tmpdir(), "hearth-latency-"));
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

/** One DevTools connection, with the handful of calls this needs. */
function connect(url) {
  const socket = new WebSocket(url);
  const waiting = new Map();
  const listeners = new Map();
  let next = 1;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      waiting.get(message.id)?.(message);
      waiting.delete(message.id);
      return;
    }
    listeners.get(message.method)?.(message.params);
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
    on(method, listener) {
      listeners.set(method, listener);
    },
    close: () => socket.close(),
  };
}

const list = await targets();
const controlAt = list.find((one) => one.url.includes("control/index.html"));
const outputAt = list.find((one) => one.url.includes("output/index.html"));

if (controlAt === undefined || outputAt === undefined) {
  console.error("The application did not open both a control window and an output.");
  console.error(noise.trim().slice(0, 1000));
  stop(1);
}

const control = connect(controlAt.webSocketDebuggerUrl);
const output = connect(outputAt.webSocketDebuggerUrl);
await Promise.all([control.open, output.open]);

// A service, opened the way a church opens one. Waited for rather than timed,
// because a click sent before the window has its state back does nothing and
// the measurement that follows measures an empty deck.
await control.send("Runtime.enable");

async function value(expression) {
  const answer = await control.send("Runtime.evaluate", { expression, returnByValue: true });
  return answer.result?.result?.value;
}

async function until(expression, what) {
  for (let tries = 0; tries < 80; tries += 1) {
    if ((await value(expression)) === true) return;
    await new Promise((settle) => setTimeout(settle, 100));
  }
  throw new Error(`The window never ${what}.`);
}

await until(`document.getElementById("way-sample") !== null`, "drew its start panel");
await value(`document.getElementById("way-sample").click()`);
await until(`document.getElementById("deck").children.length > 0`, "opened a service");

/**
 * The output paints when its state changes and at no other time, so the first
 * frame after the key is the moment the room saw the slide. The control window
 * has a clock in its corner and repaints every second, which is why the thing
 * being watched is the output and why a measurement taken against an empty deck
 * reads about nine hundred milliseconds: it was timing that clock.
 */
let painted = null;
output.on("Page.screencastFrame", (params) => {
  void output.send("Page.screencastFrameAck", { sessionId: params.sessionId });
  if (painted !== null) painted(performance.now());
});
await output.send("Page.enable");
await output.send("Page.startScreencast", { format: "jpeg", quality: 20, everyNthFrame: 1 });

// Let the first frames settle, so the clock starts on a still screen.
await new Promise((settle) => setTimeout(settle, 800));

const times = [];
for (let round = 0; round < ROUNDS; round += 1) {
  const changed = new Promise((settle) => {
    painted = settle;
    setTimeout(() => settle(null), 2000);
  });

  const sent = performance.now();
  // A real key event, into the window an operator presses it in.
  await control.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: round % 2 === 0 ? "ArrowRight" : "ArrowLeft",
    code: round % 2 === 0 ? "ArrowRight" : "ArrowLeft",
    windowsVirtualKeyCode: round % 2 === 0 ? 39 : 37,
  });

  const at = await changed;
  painted = null;
  if (at !== null) times.push(at - sent);
  // Past the repeat guard, so the next press is a press rather than a repeat.
  await new Promise((settle) => setTimeout(settle, 120));
}

await output.send("Page.stopScreencast");
control.close();
output.close();

if (times.length < ROUNDS / 2) {
  console.error(`Only ${times.length} of ${ROUNDS} advances painted anything.`);
  stop(1);
}

times.sort((a, b) => a - b);
const at = (fraction) => times[Math.min(times.length - 1, Math.floor(fraction * times.length))];
const report = {
  measuredAt: new Date().toISOString(),
  /*
   * What it ran on. ST21.5 names the reference hardware as a 2019 laptop with
   * four cores, 8GB and integrated graphics, because that is what is on a
   * church's media desk. A number from a faster machine is a number that has
   * not been tested, so the machine is recorded beside it.
   */
  machine: {
    platform: platform(),
    arch: arch(),
    cores: cpus().length,
    memoryGb: Math.round(totalmem() / 1024 ** 3),
    reference: cpus().length <= 4 && totalmem() <= 9 * 1024 ** 3,
  },
  rounds: times.length,
  budgetMs: BUDGET_MS,
  p50: Number(at(0.5).toFixed(1)),
  p95: Number(at(0.95).toFixed(1)),
  p99: Number(at(0.99).toFixed(1)),
  worst: Number(times[times.length - 1].toFixed(1)),
};

writeFileSync(resolve(here, "..", "latency.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(
  `${report.rounds} advances. 50th ${report.p50}ms, 95th ${report.p95}ms, 99th ${report.p99}ms, worst ${report.worst}ms.`,
);
console.log(
  `On ${report.machine.cores} cores and ${report.machine.memoryGb}GB${report.machine.reference ? ", which is reference hardware" : ", which is faster than the reference hardware in ST21.5"}.`,
);
console.log("Recorded in apps/stage/latency.json.");

if (report.p99 >= BUDGET_MS) {
  console.error(`Over the ${BUDGET_MS}ms budget at the 99th percentile (ST21.1).`);
  stop(1);
}
stop(0);
