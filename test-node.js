/* test-node.js — the proof for the Story Engine.
 *
 * Run: node test-node.js
 * Every assertion here runs the REAL engine (docs/play/story-engine.js) against
 * the REAL book (docs/play/book.js) — the same two files the page loads.
 *
 * "Done means" (QUEUE/app-story-engine.md):
 *   a choice made at a node leads to a DIFFERENT node;
 *   the same three choices replayed produce the SAME ending;
 *   the visited map lists EVERY node in the ORDER visited.
 *
 * SPDX-FileCopyrightText: 2026 Dr Sohil Momin
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 */
"use strict";

const fs = require("fs");
const path = require("path");
const SE = require("./docs/play/story-engine.js");
const BOOK = require("./docs/play/book.js");

let pass = 0;
const failures = [];
function ok(cond, name) {
  if (cond) { pass++; return; }
  failures.push(name);
  console.log("  FAIL  " + name);
}
function eq(got, want, name) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  ok(g === w, name + "  (got " + g + ", want " + w + ")");
}

/* Walk a path of choice indices from a fresh game. Returns the result chain. */
function walk(indices) {
  let state = SE.newGame(BOOK);
  const chain = [];
  for (const i of indices) {
    const r = SE.advance(BOOK, state, i);
    chain.push(r);
    if (!r.ok) return { state, chain, failed: r };
    state = r.state;
  }
  return { state, chain, failed: null };
}

/* ---------------- 1. the book compiles, and a broken one does not ---------- */
console.log("compile");
{
  const c = SE.compile(BOOK);
  ok(c.ok, "the shipped book compiles: " + JSON.stringify(c.errors.slice(0, 3)));
  ok(c.order.length === Object.keys(BOOK.nodes).length, "every node is reachable from the start (" + c.order.length + " of " + Object.keys(BOOK.nodes).length + ")");

  const broken = JSON.parse(JSON.stringify(BOOK));
  broken.nodes.trim.choices[0].to = "nowhere";
  const bad = SE.compile(broken);
  ok(!bad.ok, "a choice pointing at a missing node is refused");
  ok(bad.errors.some(e => e.code === "missing-target"), "  ... with code missing-target");

  const orphan = JSON.parse(JSON.stringify(BOOK));
  orphan.nodes.island = { title: "Island", text: "Nobody can get here.", ending: true };
  ok(!SE.compile(orphan).ok, "an unreachable passage is refused, not shipped");

  const undeclared = JSON.parse(JSON.stringify(BOOK));
  undeclared.nodes.trim.choices[0].effects = [{ var: "luck", op: "add", value: 1 }];
  ok(SE.compile(undeclared).errors.some(e => e.code === "unknown-var"), "an effect on an undeclared variable is refused");

  const dead = JSON.parse(JSON.stringify(BOOK));
  delete dead.nodes.trim.choices;
  ok(SE.compile(dead).errors.some(e => e.code === "dead-end"), "a passage with no choices and no ending is refused");
}

/* ---------------- 2. a choice leads to a DIFFERENT node -------------------- */
console.log("a choice leads somewhere else");
{
  const g = SE.newGame(BOOK);
  eq(g.at, "watch", "a new game starts at the start node");
  eq(g.visited, ["watch"], "the trail begins with the start node");

  const a = SE.advance(BOOK, g, 0);
  const b = SE.advance(BOOK, g, 1);
  ok(a.ok && b.ok, "both opening choices are open");
  eq(a.state.at, "trim", "choice 0 goes to trim");
  eq(b.state.at, "flare", "choice 1 goes to flare");
  ok(a.state.at !== b.state.at, "two choices at one node lead to two different nodes");
  ok(a.state.at !== g.at && b.state.at !== g.at, "neither leads back to the node it came from");

  const offers = SE.choicesFor(BOOK, g);
  eq(offers.map(o => o.index), [0, 1], "the reader is offered both choices, by index");
  eq(offers[0].to, "trim", "the offer names its destination");
}

/* ---------------- 3. the same choices replay to the same ending ------------ */
console.log("determinism");
{
  const pathA = [0, 0, 0, 0];   // trim -> logbook -> causeway -> signal
  const one = walk(pathA);
  const two = walk(pathA);
  ok(one.failed === null && two.failed === null, "the three-choice path is walkable");
  eq(one.state.at, "e_seen", "trim -> logbook -> causeway ends at the signal ending");
  eq(one.state.ending, "Seen from the fifth mile", "the ending is named");
  eq(one.state.vars, two.state.vars, "the same choices leave the same state");
  eq(one.state.visited, two.state.visited, "the same choices leave the same trail");
  eq(one.state.ending, two.state.ending, "the same three choices produce the same ending");
  eq(one.state.steps, 4, "four choices are four steps");

  const other = walk([0, 0, 0, 1]);
  eq(other.state.at, "e_wait", "the same two choices then a different third give a different ending");
  ok(other.state.ending !== one.state.ending, "and a different ending is a different story");

  const third = walk([1, 1, 0]);
  eq(third.state.at, "e_keeper", "flare -> keep ends at the keeper's dawn");
}

/* ---------------- 4. the trail is every node, in order -------------------- */
console.log("the trail");
{
  const g = walk([1, 0, 0, 0]).state;   // flare -> boat -> causeway -> signal
  eq(g.visited, ["watch", "flare", "boat", "causeway", "e_seen"], "the trail lists every node in the order visited");
  const t = SE.trail(BOOK, g);
  eq(t.length, g.visited.length, "one trail entry per visit, repeats included");
  eq(t.map(x => x.id), g.visited, "the map is the visited order, not a set");
  eq(t[1].title, "The whole sky", "each entry carries its passage title");
  ok(t[t.length - 1].ending, "the last entry is marked as an ending");

  // a repeat visit is recorded twice, not collapsed into a set
  const back = walk([0, 0, 1, 2]);             // trim -> logbook -> keep -> logbook again
  eq(back.state.at, "logbook", "a passage can be returned to");
  eq(back.state.visited, ["watch", "trim", "logbook", "keep", "logbook"], "the second visit to a passage is recorded again, in order");
  eq(SE.trail(BOOK, back.state).length, 5, "the map counts the return, it does not de-duplicate");
}

/* ---------------- 5. state gates the book (the state IS the story) -------- */
console.log("state gates");
{
  // the same passage, reached two ways, offers different doors
  const viaTrim = walk([0, 1]).state;        // trim -> boat : nerve 0
  const viaFlare = walk([1, 0]).state;       // flare -> boat : nerve 1
  eq(viaTrim.at, viaFlare.at, "both paths arrive at the same passage");
  eq(SE.choicesFor(BOOK, viaTrim).map(c => c.index), [1], "with nerve 0 the bell-buoy choice is closed");
  eq(SE.choicesFor(BOOK, viaFlare).map(c => c.index), [0, 1], "with nerve 1 it is open");
  eq(SE.lockedChoicesFor(BOOK, viaTrim).map(c => c.index), [0], "a closed door is shown as closed, not hidden");
  ok(viaTrim.vars.oil !== viaFlare.vars.oil, "the two arrivals also differ in oil");

  const refused = SE.advance(BOOK, viaTrim, 0);
  ok(!refused.ok, "advancing through a closed choice is refused");
  eq(refused.code, "locked-choice", "  ... with code locked-choice");
  eq(refused.state, viaTrim, "  ... and the state is untouched");
}

/* ---------------- 6. bad input is refused with the passage shown ---------- */
console.log("bad input");
{
  const g = SE.newGame(BOOK);
  const cases = [
    [-1, "a negative index"],
    [2, "an index past the end"],
    [99, "a far index"],
    ["0", "a string index"],
    [1.5, "a fractional index"],
    [null, "null"],
    [undefined, "undefined"]
  ];
  for (const [idx, label] of cases) {
    const r = SE.advance(BOOK, g, idx);
    ok(!r.ok, label + " is refused");
    ok(r.passage && r.passage.id === "watch", label + " is refused WITH the current passage shown");
    ok(r.passage && r.passage.text.length > 0, label + " refusal carries the passage text, not an empty screen");
    eq(r.state, g, label + " leaves the reader where they were");
  }

  const atEnd = walk([0, 0, 0, 0]).state;
  const r = SE.advance(BOOK, atEnd, 0);
  ok(!r.ok && r.code === "at-ending", "a choice at an ending is refused with code at-ending");

  const nowhere = SE.advance(BOOK, { at: "atlantis", vars: {}, visited: ["atlantis"], steps: 0 }, 0);
  ok(!nowhere.ok && nowhere.code === "unknown-passage", "a reader in no passage of this book is refused");
}

/* ---------------- 7. a corrupt save is REPORTED, never reset -------------- */
console.log("corrupt save");
{
  const g = walk([0, 0]).state;      // trim -> logbook
  const raw = SE.save(g);
  const back = SE.load(BOOK, raw);
  ok(back.ok, "a save round-trips");
  eq(back.state.at, g.at, "  ... at the same passage");
  eq(back.state.vars, g.vars, "  ... with the same state");
  eq(back.state.visited, g.visited, "  ... and the same trail");

  const bad = [
    ["", "empty", "an empty save"],
    ["   ", "empty", "a blank save"],
    ["{not json", "corrupt", "truncated JSON"],
    ["null", "corrupt", "JSON null"],
    ['"a string"', "corrupt", "a JSON string"],
    ['{"format":"other/1","state":{}}', "wrong-format", "another format"],
    ['{"format":"story-engine/1"}', "corrupt", "no state"],
    [JSON.stringify({ format: SE.FORMAT, book: BOOK.id, state: { at: "atlantis", visited: ["atlantis"] } }), "unknown-passage", "a passage that is not in the book"],
    [JSON.stringify({ format: SE.FORMAT, book: BOOK.id, state: { at: "trim", visited: [] } }), "corrupt", "no trail"],
    [JSON.stringify({ format: SE.FORMAT, book: BOOK.id, state: { at: "trim", visited: ["trim", "atlantis"] } }), "corrupt", "a trail naming a passage that is not in the book"]
  ];
  for (const [text, code, label] of bad) {
    const r = SE.load(BOOK, text);
    ok(!r.ok, label + " is refused");
    eq(r.code, code, label + " reports " + code);
    ok(r.message && r.message.length > 8, label + " says why, in words");
    ok(r.state === undefined, label + " never returns a state (so it cannot resume at the start and call it the reader's place)");
  }

  const other = SE.load(BOOK, JSON.stringify({ format: SE.FORMAT, book: "some-other-book", state: { at: "trim", visited: ["trim"] } }));
  ok(!other.ok && other.code === "other-book", "a save from a different book is refused, not resumed");

  const claimed = SE.load(BOOK, JSON.stringify({ format: SE.FORMAT, book: BOOK.id, state: { at: "atlantis", visited: ["watch"] } }));
  eq(claimed.claimed, "atlantis", "a refusal names the passage the save claims, so it can be shown to the reader");
}

/* ---------------- 8. a full disk stops the saving, not the reading -------- */
console.log("storage");
{
  const mem = (function () {
    const m = {};
    return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _raw: m };
  })();
  const store = SE.createStore(mem, "test:save");
  const g = walk([1]).state;
  eq(store.save(g), { saved: true, code: "ok", message: "" }, "a working store saves");
  const back = store.load(BOOK);
  ok(back.ok && back.state.at === "flare", "and loads back at the same passage");

  const fullBackend = { getItem: () => null, setItem: () => { const e = new Error("The quota has been exceeded."); e.name = "QuotaExceededError"; throw e; }, removeItem: () => {} };
  const full = SE.createStore(fullBackend);
  const r = full.save(g);
  eq(r.saved, false, "a full disk reports that nothing was saved");
  eq(r.code, "storage-full", "  ... with code storage-full");
  ok(/room/.test(r.message), "  ... in words the reader can act on");
  eq(g.at, "flare", "the reading itself is untouched by a failed save");

  const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
  const b = SE.createStore(broken);
  eq(b.save(g).code, "storage-unavailable", "a storage that refuses reports storage-unavailable");
  const bl = b.load(BOOK);
  ok(!bl.ok && bl.code === "storage-unavailable", "and loading reports it rather than pretending there is no save");

  const none = SE.createStore(null);
  ok(!none.save(g).saved && !none.load(BOOK).ok, "no storage at all is reported, not silently ignored");

  // a corrupt save sitting in real storage is reported with its excerpt
  mem._raw["test:save"] = '{"format":"story-engine/1","book":"the-fifth-mile","state":{"at":"atlantis"}}';
  const corrupt = store.load(BOOK);
  ok(!corrupt.ok && corrupt.code === "unknown-passage", "a corrupt save in storage is reported");
  ok(corrupt.excerpt && corrupt.excerpt.length > 10, "  ... with an excerpt that can be exported for the owner to look at");
}

/* ---------------- 9. the shipped page is offline and wired ---------------- */
console.log("the page");
{
  const dir = path.join(__dirname, "docs", "play");
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  const js = html.replace(/<!--[\s\S]*?-->/g, "");

  ok(/story-engine\.js/.test(html), "the page loads the engine");
  ok(/book\.js/.test(html), "the page loads the book");
  ok(!/\bfetch\s*\(/.test(js), "the page never calls fetch()");
  ok(!/XMLHttpRequest/.test(js), "the page never constructs an XMLHttpRequest");
  ok(!/new\s+WebSocket|new\s+EventSource/.test(js), "the page opens no socket");
  const remote = (js.match(/(?:src|href)\s*=\s*["']https?:\/\/[^"']+/g) || []);
  eq(remote, [], "no script or stylesheet is loaded from another host");
  ok(/StoryEngine/.test(js), "the page uses the engine it loads");
  ok(/passage-text"\)\.textContent/.test(js), "the passage is written as text, never as HTML");
  ok(!/innerHTML\s*=\s*[a-zA-Z_]/.test(js), "no variable is ever assigned to innerHTML");
  ok(/Book|book/.test(js), "the page carries the book it loads");
  const engine = fs.readFileSync(path.join(dir, "story-engine.js"), "utf8");
  ok(!/eval\s*\(|new\s+Function\s*\(/.test(engine), "the engine never evaluates a string as code");
  ok(!/Math\.random/.test(engine), "the engine never rolls a die — the same choices must give the same ending");
}

console.log("");
if (failures.length) {
  console.log(failures.length + " FAILED, " + pass + " passed");
  process.exit(1);
}
console.log(pass + "/0 failures — the story engine behaves as specified");
