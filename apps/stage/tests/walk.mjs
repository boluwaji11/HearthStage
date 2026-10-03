/**
 * STG-170. Walks the one window, in the built application.
 *
 * The merge of the editor into the window that presents is a layout change, and
 * neither the unit tests nor the smoke run can see a page that paints behind
 * another one or an empty box where a list should be. This drives the real
 * application over the DevTools protocol and reads what is on screen.
 *
 *   pnpm --filter @hearth/stage build && pnpm --filter @hearth/stage walk
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const electron = require("electron");
const APP = process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 9300 + Math.floor(Math.random() * 600);
const data = mkdtempSync(join(tmpdir(), "hearth-walk-"));
const env = { ...process.env }; delete env["ELECTRON_RUN_AS_NODE"];
const app = spawn(electron, [APP, `--remote-debugging-port=${PORT}`, `--user-data-dir=${data}`], { stdio: ["ignore","pipe","pipe"], env });
let noise = ""; app.stdout.on("data", c => noise += c); app.stderr.on("data", c => noise += c);
function stop(code){ app.kill(); rmSync(data,{recursive:true,force:true}); process.exit(code); }
async function targets(){ for(let i=0;i<60;i++){ try{ const r=await fetch(`http://127.0.0.1:${PORT}/json/list`); const l=await r.json(); if(l.some(o=>o.url.includes("control/index.html"))) return l; }catch{} await new Promise(s=>setTimeout(s,250)); } throw new Error("no debugging port"); }
function connect(url){ const s=new WebSocket(url); const waiting=new Map(); let next=1;
  s.addEventListener("message",e=>{ const m=JSON.parse(e.data); if(m.id!==undefined){ waiting.get(m.id)?.(m); waiting.delete(m.id);} });
  return { open:new Promise(r=>s.addEventListener("open",r)), send:(method,params={})=>{ const id=next++; return new Promise(r=>{ waiting.set(id,r); s.send(JSON.stringify({id,method,params})); }); } }; }
const list = await targets();
const at = list.find(o=>o.url.includes("control/index.html"));
const c = connect(at.webSocketDebuggerUrl); await c.open;
await c.send("Runtime.enable");
const evalIn = async (expr) => { const r = await c.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result?.result?.value; };
const shown = (sel) => `(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return "missing"; const r=e.getBoundingClientRect(); return getComputedStyle(e).display==="none"?"hidden":`+"`${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.left)},${Math.round(r.top)}`"+`;})()`;
const fail = [];
/** Polls, because a paint and the frame after it are not the same moment. */
const waitFor = async (expr, tries = 20) => {
  for (let at = 0; at < tries; at += 1) {
    if (await evalIn(expr) === true) return true;
    await new Promise(s => setTimeout(s, 100));
  }
  return false;
};
const check = async (label, sel, want) => { const got = await evalIn(shown(sel)); const ok = want(got); console.log(`${ok?"ok  ":"FAIL"}  ${label}: ${got}`); if(!ok) fail.push(label); };
const visible = g => g !== "hidden" && g !== "missing" && !g.startsWith("0x");
const hidden = g => g === "hidden";

await new Promise(s=>setTimeout(s,1500));
console.log("-- landing");
await check("landing ways", "#start", visible);
await check("workbench away", "#workbench", hidden);
await check("settings on landing", "#way-settings", visible);

await evalIn(`document.getElementById("way-plans").click()`);
await new Promise(s=>setTimeout(s,600));
console.log("-- service plans");
await check("workbench", "#workbench", visible);
await check("plans page", "#plans-view", visible);
await check("landing away", "#start", hidden);
await check("footer away", "body > footer", hidden);
await check("create button", "#plan-create", visible);
console.log("   title:", await evalIn(`document.querySelector("#plans-view h1").textContent`));
console.log("   window title:", await evalIn(`document.title`));

await evalIn(`document.getElementById("to-service").click()`);
await new Promise(s=>setTimeout(s,600));
console.log("-- back out");
await check("landing back", "#start", visible);
await check("workbench away", "#workbench", hidden);

await evalIn(`document.getElementById("way-library").click()`);
await new Promise(s=>setTimeout(s,600));
console.log("-- library");
await check("kinds centred", "#kinds", visible);
console.log("   kinds box:", await evalIn(shown("#kinds")));
await evalIn(`document.getElementById("kind-song").click()`);
await new Promise(s=>setTimeout(s,600));
await check("tiles", "#tiles", visible);
await check("new song", "#new", visible);
// A library with something in it, which the rest of the walk needs.
await evalIn(`(()=>{const b=document.getElementById("add-samples"); if(b && !b.hidden){b.click(); return "offered";} return "already there";})()`).then(r=>console.log("   hymns:", r));
await new Promise(s=>setTimeout(s,2500));
console.log("   songs on the shelf:", await evalIn(`document.querySelectorAll("#tiles li").length`));
console.log("   library title:", await evalIn(`document.getElementById("library-title").textContent`));

await evalIn(`document.getElementById("way-settings") && 0; document.getElementById("library-back").click()`);
await new Promise(s=>setTimeout(s,600));
await check("back to kinds", "#kinds", visible);

await evalIn(`document.getElementById("library-back").click()`);
await new Promise(s=>setTimeout(s,500));
await evalIn(`document.getElementById("way-settings").click()`);
await new Promise(s=>setTimeout(s,600));
console.log("-- settings");
await check("settings page", "#settings-view", visible);
await check("device name", "#device-name", visible);
await evalIn(`document.getElementById("settings-back").click()`);
await new Promise(s=>setTimeout(s,500));
await check("landing back", "#start", visible);

console.log("-- a plan, and the picker");
await evalIn(`document.getElementById("way-plans").click()`);
await new Promise(s=>setTimeout(s,600));
await evalIn(`document.getElementById("plan-create").click()`);
await new Promise(s=>setTimeout(s,700));
await check("service view", "#service-view", visible);
await check("new slide", "#entry-slide", visible);
await evalIn(`document.getElementById("service-name").value="Morning Service"; document.getElementById("service-name").dispatchEvent(new Event("input")); document.getElementById("service-name").dispatchEvent(new Event("blur"))`);
await new Promise(s=>setTimeout(s,700));
await evalIn(`document.getElementById("entry-add").click()`);
await new Promise(s=>setTimeout(s,500));
await check("picker", "#pick", visible);
await check("picker kinds", ".pick-kinds", visible);
console.log("   picker box:", await evalIn(shown("#pick")), "window", await evalIn(`innerWidth+"x"+innerHeight`));
const centred = await evalIn(`(()=>{const r=document.getElementById("pick").getBoundingClientRect(); const dx=Math.abs((r.left+r.right)/2-innerWidth/2); return dx<40;})()`);
console.log((centred?"ok  ":"FAIL")+"  picker centred"); if(!centred) fail.push("picker centred");
await evalIn(`document.getElementById("pick-close").click()`);
await new Promise(s=>setTimeout(s,400));
await check("picker closed", "#pick", hidden);

console.log("-- a slide inside the plan");
await evalIn(`document.getElementById("entry-slide").click()`);
await new Promise(s=>setTimeout(s,800));
await check("item editor", "#edit-view", visible);
await check("service view away", "#service-view", hidden);
await check("save to library hidden before a save", "#to-library", hidden);
await evalIn(`document.getElementById("title").value="Notices"; document.getElementById("title").dispatchEvent(new Event("input"))`);
await evalIn(`document.getElementById("add").click()`);
await new Promise(s=>setTimeout(s,400));
await evalIn(`(()=>{const t=document.querySelector("#slides textarea"); if(!t) return "no box"; t.value="Church lunch"; t.dispatchEvent(new Event("input")); t.dispatchEvent(new Event("blur")); return "typed";})()`);
await new Promise(s=>setTimeout(s,1200));
await check("save to library now offered", "#to-library", visible);
await evalIn(`document.getElementById("back").click()`);
await new Promise(s=>setTimeout(s,700));
await check("back on the plan", "#service-view", visible);
console.log("   entries:", await evalIn(`[...document.querySelectorAll("#entries li")].map(e=>e.textContent.trim().slice(0,30))`));

console.log("-- the plan on the landing page (STG-48)");
await evalIn(`document.getElementById("service-back").click()`);
await new Promise(s=>setTimeout(s,600));
await evalIn(`document.getElementById("to-service").click()`);
await new Promise(s=>setTimeout(s,800));
await check("next up offered", "#start-next", visible);
console.log("   next up:", await evalIn(`document.getElementById("start-next").textContent.trim().replace(/\\s+/g," ")`));
const focused = await waitFor(`document.activeElement === document.getElementById("start-next")`);
console.log((focused?"ok  ":"FAIL")+"  next up has the focus"); if(!focused) fail.push("focus");
await evalIn(`document.getElementById("start-next").click()`);
await new Promise(s=>setTimeout(s,900));
await check("service running", "#running", visible);
await check("landing away", "#start", hidden);
console.log("   on screen:", await evalIn(`document.querySelector("#live")?.textContent?.trim().slice(0,40)`));

console.log("-- a song called from the floor (STG-49)");
await check("add a song offered", "#call-open", visible);
const before = await evalIn(`document.querySelectorAll("#deck li").length`);
const started = Date.now();
await evalIn(`document.getElementById("call-open").click()`);
await new Promise(s=>setTimeout(s,400));
await check("the card", "#call", visible);
console.log("   focus:", await evalIn(`document.activeElement.id`));
console.log("   says:", await evalIn(`document.getElementById("call-empty").hidden ? "a list" : document.getElementById("call-empty").textContent`));
await evalIn(`(()=>{const b=document.querySelector("#call-list button"); if(b){b.click(); return "picked";} return "nothing to pick";})()`).then(r=>console.log("   pick:", r));
await new Promise(s=>setTimeout(s,900));
await check("card closed", "#call", hidden);
const after = await evalIn(`document.querySelectorAll("#deck li").length`);
console.log(`   deck went from ${before} to ${after} in ${Date.now()-started}ms`);
if (after <= before) fail.push("nothing added to the deck");
else console.log("ok    the deck grew");

console.log("-- back to the chorus (STG-50)");
await check("go to offered", "#jump-open", visible);
const labels = await evalIn(`[...document.querySelectorAll("#deck li")].map(e=>e.textContent.trim().slice(0,6))`);
console.log("   deck:", labels.slice(0, 8));
const wanted = await evalIn(`(()=>{const c=[...document.querySelectorAll("#deck li")]; return c.length;})()`);
await evalIn(`document.getElementById("jump-open").click()`);
await new Promise(s=>setTimeout(s,400));
await check("the card", "#jump", visible);
console.log("   focus:", await evalIn(`document.activeElement.id`));
await evalIn(`(()=>{const i=document.getElementById("jump-label"); i.value="zz"; i.dispatchEvent(new Event("input"));})()`);
await new Promise(s=>setTimeout(s,250));
console.log("   on a label that is not there:", await evalIn(`document.getElementById("jump-found").textContent`));
// A label the deck actually has, read off the deck rather than assumed.
const label = await evalIn(`(()=>{const m=[...document.querySelectorAll("#deck .cue-tag")].map(e=>e.textContent.trim()).filter(Boolean); return m[m.length-1] ?? "";})()`);
console.log("   typing:", JSON.stringify(label));
await evalIn(`(()=>{const i=document.getElementById("jump-label"); i.value=${JSON.stringify(label)}; i.dispatchEvent(new Event("input"));})()`);
await new Promise(s=>setTimeout(s,250));
const says = await evalIn(`document.getElementById("jump-found").textContent`);
console.log("   it says:", JSON.stringify(says));
const liveBefore = await evalIn(`document.querySelector("#live")?.textContent?.trim().slice(0,40)`);
await evalIn(`document.getElementById("jump-label").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))`);
await new Promise(s=>setTimeout(s,700));
await check("card closed", "#jump", hidden);
const liveAfter = await evalIn(`document.querySelector("#live")?.textContent?.trim().slice(0,40)`);
console.log("   live:", JSON.stringify(liveBefore), "->", JSON.stringify(liveAfter));
if (says !== "" && liveAfter === liveBefore) fail.push("the jump did not move the deck");
else console.log("ok    the jump moved the deck");

const errs = noise.split("\n").filter(l=>/Uncaught|Refused|SecurityError/i.test(l));
if (errs.length) { console.log("CONSOLE:", errs.slice(0,8).join("\n")); fail.push("console"); }
console.log(fail.length ? `\nFAILED: ${fail.join(", ")}` : "\nAll good.");
stop(fail.length ? 1 : 0);
