/* story-engine.js — the Story Engine core.
 *
 * A book the reader moves through. The engine's whole job is to make the STATE
 * the story: a choice at a node leads to a different node, the same choices
 * replayed produce the same ending, and the trail records every node in the
 * order it was visited.
 *
 * Everything here is a pure function of (book, state, choice). No clock, no
 * network, no randomness, no eval — the book is DATA, and a condition is a
 * declarative {var, op, value} triple rather than a string of code.
 *
 * Runs unchanged in the browser (window.StoryEngine) and in node
 * (require("./story-engine.js")).
 *
 * PolyForm Noncommercial 1.0.0. (c) 2026 Dr Sohil Momin.
 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root) root.StoryEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var FORMAT = "story-engine/1";
  var CMP = {
    "==": function (a, b) { return a === b; },
    "!=": function (a, b) { return a !== b; },
    ">=": function (a, b) { return a >= b; },
    "<=": function (a, b) { return a <= b; },
    ">": function (a, b) { return a > b; },
    "<": function (a, b) { return a < b; }
  };
  var EFFECT = {
    set: function (a, b) { return b; },
    add: function (a, b) { return a + b; },
    sub: function (a, b) { return a - b; }
  };

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

  /* ---------------- compile: a broken book must be refused, not read --------- */

  /* Returns {ok, errors[], warnings[], order[]}. An error means the book cannot
   * be read at all; a warning is something the author should fix. */
  function compile(book) {
    var errors = [], warnings = [];
    function err(code, message, node) { errors.push({ code: code, message: message, node: node || null }); }

    if (!isObj(book)) return { ok: false, errors: [{ code: "not-a-book", message: "the book is not an object", node: null }], warnings: [], order: [] };
    if (!book.id) err("no-id", "the book has no id");
    if (!isObj(book.nodes) || Object.keys(book.nodes).length === 0) {
      return { ok: false, errors: errors.concat([{ code: "no-nodes", message: "the book has no nodes", node: null }]), warnings: [], order: [] };
    }
    var vars = isObj(book.vars) ? book.vars : {};
    var nodes = book.nodes;
    var ids = Object.keys(nodes);

    if (!book.start) err("no-start", "the book has no start node");
    else if (!nodes[book.start]) err("no-start", "the start node " + JSON.stringify(book.start) + " is not in the book", book.start);

    ids.forEach(function (id) {
      var n = nodes[id];
      if (!isObj(n)) { err("bad-node", "node " + JSON.stringify(id) + " is not an object", id); return; }
      if (typeof n.text !== "string" || !n.text.trim()) err("no-text", "node " + JSON.stringify(id) + " has no text", id);
      var ch = n.choices === undefined ? [] : n.choices;
      if (!Array.isArray(ch)) { err("bad-choices", "node " + JSON.stringify(id) + " has a choices field that is not a list", id); return; }
      if (n.ending && ch.length) err("ending-with-choices", "node " + JSON.stringify(id) + " is an ending and also offers choices", id);
      if (!n.ending && !ch.length) err("dead-end", "node " + JSON.stringify(id) + " is not an ending and offers no choices", id);
      ch.forEach(function (c, i) {
        var where = "node " + JSON.stringify(id) + " choice " + i;
        if (!isObj(c)) { err("bad-choice", where + " is not an object", id); return; }
        if (typeof c.label !== "string" || !c.label.trim()) err("bad-choice", where + " has no label", id);
        if (!c.to) err("no-target", where + " has no target", id);
        else if (!nodes[c.to]) err("missing-target", where + " points at " + JSON.stringify(c.to) + ", which is not in the book", id);
        (c.requires || []).forEach(function (r) {
          if (!isObj(r) || !CMP[r.op]) { err("bad-condition", where + " has an unreadable condition", id); return; }
          if (!Object.prototype.hasOwnProperty.call(vars, r.var)) err("unknown-var", where + " tests " + JSON.stringify(r.var) + ", which the book never declares", id);
        });
        (c.effects || []).forEach(function (e) {
          if (!isObj(e) || !EFFECT[e.op]) { err("bad-effect", where + " has an unreadable effect", id); return; }
          if (!Object.prototype.hasOwnProperty.call(vars, e.var)) err("unknown-var", where + " writes " + JSON.stringify(e.var) + ", which the book never declares", id);
        });
      });
    });

    /* Reachability: an unreachable passage is a passage nobody will ever read. */
    var order = [], seen = {};
    if (nodes[book.start]) {
      var queue = [book.start];
      seen[book.start] = true;
      while (queue.length) {
        var id = queue.shift();
        order.push(id);
        var n = nodes[id];
        if (!isObj(n) || !Array.isArray(n.choices)) continue;
        n.choices.forEach(function (c) {
          if (isObj(c) && c.to && nodes[c.to] && !seen[c.to]) { seen[c.to] = true; queue.push(c.to); }
        });
      }
      ids.forEach(function (id) { if (!seen[id]) err("unreachable", "node " + JSON.stringify(id) + " cannot be reached from the start", id); });
      var endings = order.filter(function (id) { return nodes[id] && nodes[id].ending; });
      if (!endings.length) err("no-ending", "no ending can be reached from the start");
      else if (endings.length === 1) warnings.push("only one ending is reachable — the choices cannot diverge");
    }

    return { ok: errors.length === 0, errors: errors, warnings: warnings, order: order };
  }

  /* ---------------- conditions and effects ---------------- */

  function holds(cond, vars) {
    var f = CMP[cond.op];
    if (!f) return false;
    return !!f(vars[cond.var], cond.value);
  }
  function allows(choice, vars) {
    var req = choice.requires || [];
    for (var i = 0; i < req.length; i++) if (!holds(req[i], vars)) return false;
    return true;
  }
  function applyEffects(choice, vars) {
    (choice.effects || []).forEach(function (e) {
      var f = EFFECT[e.op];
      if (f) vars[e.var] = f(vars[e.var], e.value);
    });
    return vars;
  }

  /* ---------------- a game ---------------- */

  function newGame(book) {
    var vars = isObj(book.vars) ? clone(book.vars) : {};
    var start = book.start;
    var node = book.nodes[start];
    return {
      book: book.id || null,
      at: start,
      vars: vars,
      visited: [start],
      steps: 0,
      ending: node && node.ending ? (node.endingTitle || node.title || start) : null
    };
  }

  /* Every choice the reader can actually take, in the author's order. `index`
   * is the choice's position in the node, so a click can name it unambiguously. */
  function choicesFor(book, state) {
    var node = book.nodes[state.at];
    if (!node || node.ending || !Array.isArray(node.choices)) return [];
    var out = [];
    node.choices.forEach(function (c, i) {
      if (allows(c, state.vars)) out.push({ index: i, label: c.label, to: c.to });
    });
    return out;
  }

  /* The choices the book has but the state does not allow — shown greyed, so a
   * reader can see that their state closed a door rather than that the book is thin. */
  function lockedChoicesFor(book, state) {
    var node = book.nodes[state.at];
    if (!node || node.ending || !Array.isArray(node.choices)) return [];
    var out = [];
    node.choices.forEach(function (c, i) {
      if (!allows(c, state.vars)) out.push({ index: i, label: c.label, to: c.to });
    });
    return out;
  }

  function passage(book, id) {
    var n = book.nodes[id];
    if (!n) return null;
    return { id: id, title: n.title || id, text: n.text, ending: !!n.ending };
  }

  function refuse(code, message, state, book) {
    var p = state ? passage(book, state.at) : null;
    return { ok: false, code: code, message: message, passage: p, state: state ? clone(state) : null };
  }

  /* Advance by ONE choice. On any refusal the state is returned untouched —
   * a bad choice never leaves the reader in an undefined position. */
  function advance(book, state, index) {
    if (!state || !book.nodes[state.at]) return refuse("unknown-passage", "the reader is not in a passage of this book", state, book);
    var node = book.nodes[state.at];
    if (node.ending) return refuse("at-ending", "this passage ends the book — there is nothing further to choose", state, book);
    if (typeof index !== "number" || index % 1 !== 0) return refuse("unknown-choice", "a choice is named by a whole number, not " + JSON.stringify(index), state, book);
    if (index < 0 || index >= node.choices.length) return refuse("unknown-choice", "this passage has " + node.choices.length + " choice(s); " + index + " is not one of them", state, book);
    var choice = node.choices[index];
    if (!allows(choice, state.vars)) return refuse("locked-choice", "that choice is not open to this reader in this state", state, book);
    if (!book.nodes[choice.to]) return refuse("missing-target", "that choice leads to " + JSON.stringify(choice.to) + ", which is not in the book", state, book);

    var next = {
      book: state.book,
      at: choice.to,
      vars: applyEffects(choice, clone(state.vars)),
      visited: state.visited.concat([choice.to]),
      steps: state.steps + 1,
      ending: null
    };
    var dest = book.nodes[choice.to];
    if (dest.ending) next.ending = dest.endingTitle || dest.title || choice.to;
    return { ok: true, code: "ok", message: "", passage: passage(book, choice.to), state: next, choice: { index: index, label: choice.label } };
  }

  /* The trail: every node in the order visited, repeats included, titled. */
  function trail(book, state) {
    return state.visited.map(function (id, i) {
      var n = book.nodes[id];
      return { step: i, id: id, title: (n && (n.title || id)) || id, ending: !!(n && n.ending) };
    });
  }

  /* ---------------- saving: a corrupt save is REPORTED, never reset --------- */

  function save(state) {
    return JSON.stringify({ format: FORMAT, book: state.book, savedAt: null, state: state });
  }

  /* load(book, raw) -> {ok:true, state} | {ok:false, code, message, excerpt}
   * It never returns a start state on failure: resuming at the beginning and
   * calling it the reader's place would be a lie about their own book. */
  function load(book, raw) {
    if (typeof raw !== "string" || !raw.trim()) return { ok: false, code: "empty", message: "there is no saved reading to open", excerpt: "" };
    var parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { return { ok: false, code: "corrupt", message: "the saved reading is not readable JSON: " + String(e.message || e), excerpt: raw.slice(0, 160) }; }
    if (!isObj(parsed)) return { ok: false, code: "corrupt", message: "the saved reading is not an object", excerpt: raw.slice(0, 160) };
    if (parsed.format !== FORMAT) return { ok: false, code: "wrong-format", message: "the saved reading was written in " + JSON.stringify(parsed.format) + ", not " + FORMAT, excerpt: raw.slice(0, 160) };
    if (parsed.book && book.id && parsed.book !== book.id) return { ok: false, code: "other-book", message: "the saved reading belongs to " + JSON.stringify(parsed.book) + ", not " + JSON.stringify(book.id), excerpt: raw.slice(0, 160) };
    var s = parsed.state;
    if (!isObj(s)) return { ok: false, code: "corrupt", message: "the saved reading has no state", excerpt: raw.slice(0, 160) };
    if (!s.at || !book.nodes[s.at]) return { ok: false, code: "unknown-passage", message: "the saved reading resumes at " + JSON.stringify(s.at) + ", which is not a passage in this book", excerpt: raw.slice(0, 160), claimed: s.at };
    if (!Array.isArray(s.visited) || !s.visited.length) return { ok: false, code: "corrupt", message: "the saved reading has no trail", excerpt: raw.slice(0, 160) };
    var badStep = s.visited.filter(function (id) { return !book.nodes[id]; })[0];
    if (badStep) return { ok: false, code: "corrupt", message: "the trail names " + JSON.stringify(badStep) + ", which is not a passage in this book", excerpt: raw.slice(0, 160) };
    var vars = isObj(book.vars) ? clone(book.vars) : {};
    if (isObj(s.vars)) Object.keys(vars).forEach(function (k) { if (Object.prototype.hasOwnProperty.call(s.vars, k)) vars[k] = s.vars[k]; });
    var node = book.nodes[s.at];
    return {
      ok: true,
      code: "ok",
      message: "",
      state: {
        book: book.id || null,
        at: s.at,
        vars: vars,
        visited: s.visited.slice(),
        steps: typeof s.steps === "number" ? s.steps : s.visited.length - 1,
        ending: node.ending ? (node.endingTitle || node.title || s.at) : null
      }
    };
  }

  /* ---------------- storage: a full disk must not stop the reading -------- */

  /* A store over any getItem/setItem pair (localStorage, or a test double).
   * save() reports {saved:false, code:"storage-full"|"storage-unavailable"} and
   * the reader keeps reading — the app says the place will not be kept. */
  function createStore(backend, key) {
    var k = key || "story-engine:save";
    function full(e) {
      var name = (e && (e.name || e.code)) || "";
      return /quota|exceeded|full/i.test(String(name) + " " + String(e && e.message));
    }
    return {
      save: function (state) {
        if (!backend || typeof backend.setItem !== "function") return { saved: false, code: "storage-unavailable", message: "this device offers nowhere to keep the place" };
        try { backend.setItem(k, save(state)); return { saved: true, code: "ok", message: "" }; }
        catch (e) {
          return {
            saved: false,
            code: full(e) ? "storage-full" : "storage-unavailable",
            message: full(e) ? "there is no room left on this device to keep the place" : "the place could not be kept: " + String((e && e.message) || e)
          };
        }
      },
      load: function (book) {
        if (!backend || typeof backend.getItem !== "function") return { ok: false, code: "storage-unavailable", message: "this device offers nowhere to keep the place", excerpt: "" };
        var raw;
        try { raw = backend.getItem(k); }
        catch (e) { return { ok: false, code: "storage-unavailable", message: "the saved reading could not be read: " + String((e && e.message) || e), excerpt: "" }; }
        if (raw === null || raw === undefined) return { ok: false, code: "empty", message: "there is no saved reading to open", excerpt: "" };
        return load(book, raw);
      },
      clear: function () {
        try { if (backend && backend.removeItem) backend.removeItem(k); return true; } catch (e) { return false; }
      }
    };
  }

  return {
    FORMAT: FORMAT,
    compile: compile,
    newGame: newGame,
    choicesFor: choicesFor,
    lockedChoicesFor: lockedChoicesFor,
    advance: advance,
    trail: trail,
    passage: passage,
    save: save,
    load: load,
    createStore: createStore
  };
});
